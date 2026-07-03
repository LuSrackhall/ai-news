# Candidate Builder — Editorial Intelligence Runtime v1.0

## Architecture Constitution v1.0

> This system is explicitly designed as a **signal-driven editorial pipeline**. Rules generate signals. Signals are resolved via deterministic policy. LLM never participates in scoring or ranking decisions.

| 不变量 | 内容 |
|--------|------|
| **Data Immutability** | Event 不可被任何 Rule 修改 |
| **Candidate Ephemerality** | Candidate 是临时 ViewModel，不持久化 |
| **Rule Determinism** | Rule 默认不使用 LLM，保持纯计算 |
| **Signal Traceability** | 每条 Signal 携带 source + reason |
| **Publication Agnostic** | Candidate Builder 不依赖具体 Publication |
| **Storage Agnostic** | Memory Store 通过接口抽象，实现可替换 |
| **LLM Boundary** | LLM 不参与 scoring 或 ranking 决策 |

## Context

当前系统在 Ingestion 的 Event Ranking（Score）与 Editorial 的 LLM Curation 之间存在空缺。所有 Event（当前 50-80 条，后期 200-500 条）直接从 SQLite 喂给 LLM——LLM 同时承担"编辑判断"和"内容生成"两项职责，导致 Breaking News 漏报、主题失衡、跨天重复等风险。

引入 **Candidate Builder** 作为 Editorial 领域服务：根据独立、可组合的 Editorial Rules，从完整 Event 集合构建增强后的 Candidate Pool，供 LLM 完成最终 Curation。

## Goals / Non-Goals

**Goals（Phase 1）：**
- 建立 Candidate Builder 领域服务 + Editorial Rule Pipeline
- 建立 Signal 模型（phase/subtype）+ Signal Lifecycle + Resolution Policy
- 实现第一批 Editorial Rules：Breaking 保底、Diversity 均衡、Editorial Memory
- LLM Curation 输入从 Event List 切换为 Candidate Pool
- 保持 Candidate Builder 与 Publication 解耦

**Non-Goals（Phase 1）：**
- Story Continuity、Novelty、Source Diversity — Phase 2
- 可配置 Rule Engine（多 Publication 不同权重）— Phase 3
- 可观测性 — Phase 3
- Rule 不调用 LLM | Candidate 不持久化 | 不修改 Event

## Decisions

### 1. Signal 模型

```
EditorialSignal = {
  phase:   "FILTER" | "RANK" | "ANNOTATION",
  subtype: "BREAKING" | "DIVERSITY_CAP" | "MEMORY" | "ENTITY_PRIORITY" | ...,
  weight:  number,        // RANK: ±30, FILTER/ANNOTATION: 0
  source:  string,        // Rule 名称，可追溯
  reason:  string,        // 人类可读触发原因
  metadata: { eventId?, category?, entity?, recentDays? },
}
```

`phase` 决定信号在哪个阶段被消费，`subtype` 是业务语义（随 Rule 增加可扩展）。

### 2. Signal Lifecycle（三阶段）

```
Phase FILTER:
  BREAKING → override all FILTER constraints for this event
  DIVERSITY_CAP → HOLD (not eligible, FILTER-phase constraint, not score penalty)

Phase RANK:
  All RANK-phase signals → additive, capped at +30 total

Phase ANNOTATION:
  MEMORY → attached as Candidate.contextHints, zero ranking effect
```

### 3. Rule 接口

```
evaluate(events: Event[], context: RuleContext) → RuleResult

RuleContext  = { date, memoryStore }
RuleResult   = { signals: EditorialSignal[] }
```

Rule 之间不互相调用，不共享可变状态。

### 4. CandidateBuilder 数据流

```
Events
  ↓
Signal Log        (immutable, all Rule outputs collected)
  ↓
Filter View       (subset: FILTER signals applied, HOLD events excluded)
  ↓
Ranked View       (sorted: score + sum(RANK signals, capped +30))
  ↓
Annotated View    (ANNOTATION signals attached as contextHints)
  ↓
Candidate[]       (top N, maxSize=40)
```

### 5. BuildResult 结构

```
BuildResult = {
  signalLog:         EditorialSignal[],
  filteredIn:        number,
  filteredOut:       number,
  rankedCandidates:  Candidate[],
  finalCandidates:   Candidate[],
}
```

### 6. 管线位置

```
Editorial Pipeline（修订后）:
  SelectEditorialWindow → BuildCandidates → CurateEvents → GenerateArticle → ...
```

`BuildCandidates` Task 读取 `ctx._events`，调用 CandidateBuilder，产出 `ctx._candidates`。`CurateEvents` Task 强制消费 `ctx._candidates`。

### 7. BreakingRule

纯确定性。触发任一条件即产出 `{ phase: "FILTER", subtype: "BREAKING", weight: 0 }`：
- top_tier 实体 + 该实体当天出现 ≤ 2 次
- 官方 Blog 来源 + cluster_size = 1
- event_type ∈ {model_release, acquisition} + score ≥ review 阈值

效果：标记 BREAKING 的 Candidate 不被后续 FILTER 信号排除，排序时获得 RANK 阶段的 priority boost。

### 8. DiversityRule

- 统计 Candidate Pool category 分布
- 覆盖 < 5 类 → 从 review tier 按缺失 category 最高分补入
- 单 category 上限 8 条（BREAKING 不计入上限）
- 超出上限的 Candidate 产出 `{ phase: "FILTER", subtype: "DIVERSITY_CAP" }`（HOLD, not score penalty）

### 9. EditorialMemoryRule

- 调用 `memoryStore.load(recent7Days)` 获取历史覆盖
- entity / cluster_id 命中 → `{ phase: "ANNOTATION", subtype: "MEMORY", metadata: { recentDays } }`
- 连续 2+ 天 → contextHints 附加提示："此事件已在最近 N 天持续报道"
- 纯标注，不对 Candidate 做降权或排除

### 10. EditorialMemoryStore 接口

```
interface EditorialMemoryStore {
  load(since: string): MemorySnapshot
  save(date: string, snapshot: DaySnapshot): void
  prune(before: string): void
}
```

Phase 1 实现：`JsonEditorialMemoryStore`（`data/editorial-memory.json`）。接口预留，未来可替换 SQLite。

## Test Coverage（实施后验证）

实施后验证结果：**82 测试用例，0 失败**

| 测试维度 | 用例数 | 覆盖范围 |
|---------|-------|---------|
| 单元测试 | 18 | BreakingRule(5) + DiversityRule(2) + MemoryRule(2) + Builder(4) + MemoryStore(3) + Pipeline(2) |
| Edge Cases | 39 | 空输入、Rule 异常容错、null字段、HOLD全覆盖、maxSize截断、JSON损坏、大输入(100条)、并发稳定性 |
| 集成测试 | 25 | 真实 config 权重、真实 SCORING 阈值、全链路编排、混合 category 补入、Task 编排 |
| 真实数据回放 | 19 | 2026-07-02 真实 curated.json 19 条事件 |

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| LLM 可能 bypass Candidate Builder | `CurateEvents` Task 层强制消费 `ctx._candidates` |
| Rule 数量增长致复杂度失控 | 每条 Rule 独立、无状态、不互调；新增仅需注册 |
| Signal weight 通胀（Rule 间 weight 互相抵消/叠加） | +30 cap + Resolution Policy 显式优先级 |
| Candidate Pool size 影响 LLM latency | maxSize=40 硬上限 |
| Multi-publication 导致 rule drift | Phase 1 保持 Publication Agnostic；Phase 3 引入 Rule Registry |
| Memory JSON 未来膨胀 | Storage Agnostic 接口，随时可切 SQLite |
