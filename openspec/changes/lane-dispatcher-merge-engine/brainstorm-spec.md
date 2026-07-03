## Context

Constitution v4.0（已冻结）定义了三层约束：

- Invariant 2: Unidirectional Dependency — Domain 承载业务规则，Runtime 只编排
- Invariant 5: Deterministic Editorial Logic — Rule/Signal/Filter/Rank 必须确定性
- Invariant 7: Runtime is Orchestration Only — Runtime 不得包含业务规则

Editorial Runtime（已设计，见 `runtimes/editorial.md`）在此宪法下定义了 Lane 作为一级抽象：Runtime 不认识具体 Lane 类型，Lane 集合由 Publication 配置定义。

Candidate Builder v1.0（已实现）提供了 Lane **内部**的排序和筛选能力（Breaking/Diversity/Memory Rules），但当前所有 Event 仍然在同一个排序空间中竞争。

**Evidence**（2026-07-02 实际数据）：

```
553 Events → Candidate Builder → 40 Candidates
  36 arXiv / 2 Chinese media / 2 English media
```

这不是评分错误——arXiv（tier 1 权威 + 学术加分）在统一排序空间中必然压倒行业新闻。根因是异构信息进入了同一个 Lane，而不是同一个排序空间。

**结论**：需要 **Lane Dispatcher** 将 Event 分发到独立的编辑轨道，每个轨道内部用现有的 CandidateBuilder 独立构建候选，再通过 **Merge Engine** 合并为全局候选池。

## Goals / Non-Goals

**Goals：**

- **Lane Dispatcher** — 将 Events 按 editorialDomain 分发到对应 Lane；每个 Event 必须且只能进入一个主 Lane；确定性分发
- **Lane Execution** — 每个 Lane 复用现有的 CandidateBuilder v1.0 独立构建候选；Lane 之间不共享状态
- **Merge Engine** — 跨 Lane 合并、全局排序、maxSize 截断；支持可配置的 Merge Policy（minimum representation / breaking override / diversity）
- **Pipeline 集成** — 用 Lane Dispatcher + Merge Engine 替换现有的 BuildCandidates Task

**Non-Goals：**

- 不改 Candidate Builder v1.0（完全冻结）
- 不改 Event scoring model
- 不引入新的 Signal type
- 不做 LLM prompt 调整
- 不做 ranking model redesign

## Decisions

### D1: Lane Dispatcher

输入 `Event[]`，输出 `Map<LaneId, Event[]>`。每个 Event 的 `editorialDomain` 字段由 Ingestion 阶段确定（EntityExtraction + EventTypeRule）。Dispatcher 不修改 Event，是纯确定性函数。

当 Event 的 editorialDomain 无法匹配任何已注册 Lane 时，进入 fallback Lane（由 Publication 配置定义）。

Runtime 不认识具体 Lane 类型。Lane 集合来自 Publication 配置。

### D2: Lane Execution

每个 Lane 的候选构建过程完全独立：

```
LaneEvents → CandidateBuilder v1.0 → LaneCandidate[]
```

Lane 之间无共享状态，CandidateBuilder 保持纯函数。每个 Lane 有独立的 LaneContext（maxSize、Rule 集合），但 Phase 2 先使用统一的默认配置。

### D3: Merge Engine

合并所有 Lane 输出的 `LaneCandidate[]` 为全局 `Candidate[]`。Merge 是多阶段 Pipeline：

1. **Collect** — 收集所有 Lane 的 candidates，标记各自的 LaneId
2. **Merge Policy** — 应用可配置的策略：
   - `minimum_representation` — 每个非空 Lane 至少贡献 1 条（如果该 Lane 有 candidate）
   - `breaking_override` — BREAKING Signal 的 candidate 跨 Lane 优先（除非全局 maxSize 超限）
   - `global_diversity` — 全局覆盖至少 5 个 category（沿用现有 DiversityRule 逻辑）
3. **Rank** — 跨 Lane 按 `finalRank` 排序
4. **Truncate** — 截断到全局 maxSize（默认 40）

Merge Engine 不修改 Candidate 本体，是纯确定性函数。

### D4: CandidateBuilder 调用变化

```
旧：events → CandidateBuilder → Candidate[]
新：events (per lane) → CandidateBuilder → LaneCandidate[]
     LaneCandidate[] (all lanes) → MergeEngine → Candidate[]
```

CandidateBuilder 的接口完全不改变，只是调用方的输入从 "全部 Events" 变为 "单 Lane Events"。

### D5: Editorial Pipeline 步骤变化

```
旧 Pipeline:
  SelectEditorialWindow → BuildCandidates → CurateEvents → ...

新 Pipeline:
  SelectEditorialWindow → DispatchLanes → ExecuteLanes → MergeCandidates → CurateEvents → ...
```

其中 `BuildCandidates` Task 拆分为：
- `DispatchLanes` — Lane Dispatcher 分发
- `ExecuteLanes` — 顺序执行各 Lane 的 CandidateBuilder（各 Lane 独立 ctx 数据）
- `MergeCandidates` — Merge Engine 合并

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Event editorialDomain 判定不准，导致分错 Lane | fallback Lane 兜底 + 日志记录校准 |
| Lane Execution 增加 Pipeline 延迟 | 各 Lane 顺序执行，Phase 2.1 可并行执行 |
| Merge Policy 配置膨胀 | Phase 2 只实现 3 种 policy，后续可扩展 |
| 已有 BreakingRule 的 BREAKING override 跨 Lane 含义不同 | MergePolicy.breaking_override 按全局 finalRank 处理，不跨 Lane 互相影响 |
