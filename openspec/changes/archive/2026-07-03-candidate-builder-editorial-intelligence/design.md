## Context

候选池构建作为 Editorial 领域的信号驱动管线。brainstorm-spec.md 定义了架构宪法和核心 Decisions——本文档聚焦实现层决策：模块划分、数据流、错误处理、测试策略。

## Goals / Non-Goals

**Goals:**
- 将 brainstorm-spec 的 Decisions 落地为可实现的模块结构
- 定义 CandidateBuilder 的执行语义（延迟、错误传播、截断行为）
- 定义 Rule 注册与执行顺序
- 定义 EditorialMemoryStore 的 JSON 格式与并发安全策略

**Non-Goals:**
- Phase 2/3 的 Story、Novelty、Source Diversity、Observability
- 多 Publication Rule Registry

## Decisions

### D1: 模块结构

```
scripts/domain/editorial/
  signal.mjs              # EditorialSignal 类型定义 + Resolution Policy
  candidate-builder.mjs   # CandidateBuilder 核心引擎
  rule-context.mjs        # RuleContext 构造
  rules/
    breaking-rule.mjs     # BreakingRule 实现
    diversity-rule.mjs    # DiversityRule 实现
    memory-rule.mjs       # EditorialMemoryRule 实现

scripts/services/
  editorial-memory-store.mjs   # JsonEditorialMemoryStore 实现

scripts/tasks-editorial/
  build-candidates.mjs    # BuildCandidates Task（管线集成点）
```

### D2: 执行语义

`CandidateBuilder.build(events, context)` 的执行顺序：

1. **Collect**: 顺序调用 `rule.evaluate(events, context)`，收集所有 Signal 到 `signalLog[]`。单条 Rule 抛异常 → 记录 warning 并跳过该 Rule（不影响其他 Rule）。
2. **Filter**: 遍历 signalLog，对 FILTER-phase signals 应用约束。BREAKING 标记的 event 免于 HOLD。构建 filterView（包含所有未被 HOLD 的 event）。
3. **Diversity Cap**（Filter 子阶段）: DiversityRule.applyCap(candidates, breakingEventIds) 标记单类别超出上限的 Candidate 为 HOLD。BREAKING 不计入类别上限。
4. **Rank**: 对 filterView 计算 finalRank = event.score + sum(RANK signals, capped +30)。按 finalRank 降序排列。
5. **Annotate**: 将 ANNOTATION-phase signals 附加到对应 Candidate 的 `contextHints[]`。
6. **Truncate**: 取 top maxSize（默认 40），返回 `BuildResult`。

> **实现说明**：DiversityRule 有两个入口——`evaluate()` 负责统计 category 分布和识别 review tier 候选；`applyCap()` 是一个独立方法，由 CandidateBuilder 在 Filter 子阶段调用，传入已构建的 Candidate 视图和 BREAKING event IDs。这种方法选择的原因是 applyCap 需要 Candidate 的 finalRank 数据（来自 Rank phase 前的基础排序），无法在 evaluate() 中提前计算。

### D3: Rule 注册

Rule 在 CandidateBuilder 构造时注入，按数组顺序执行：

```javascript
const builder = new CandidateBuilder([
  new BreakingRule(),
  new DiversityRule(),
  new EditorialMemoryRule(memoryStore),
])
```

新增 Rule 只需追加到数组。Rule 执行顺序对应数组顺序——BreakingRule 必须在 DiversityRule 之前执行（FILTER phase 的 BREAKING override 需要先于 DIVERSITY_CAP）。

### D4: memory-store JSON 格式

```json
{
  "version": 1,
  "days": {
    "2026-07-02": {
      "topEventIds": ["huxiu_1", "36kr_2", "qbitai_3", "wired_4", "tc_5"],
      "topEntities": ["OpenAI", "Meta", "Anthropic"],
      "topCategories": ["industry", "product", "funding"]
    }
  }
}
```

读写策略：Editorial Pipeline 是单次同步执行（`/daily` 手动触发），无并发竞争。`save()` 使用 `writeFileSync` 原子写。`load()` 在 Pipeline 开始时调用一次，`save()` 在 Pipeline 结束时调用一次。

### D5: 候选池大小控制

maxSize=40 是硬上限。如果 Filter View 中 event 数量 >40，按 finalRank 降序截断。如果 Filter View 中 event 数量 <10，不填充——留空交给 LLM 处理（LLM 的 curation prompt 已有"当日 AI 新闻较少"的 fallback）。

### D6: 与现有 Event 结构的兼容

Candidate 是 Event 的轻量包装：

```javascript
Candidate = {
  event: Event,             // 原始 Event 对象（只读引用）
  finalRank: number,        // score + boost
  contextHints: string[],   // ANNOTATION-phase 的提示文本
  signals: EditorialSignal[], // 该 Candidate 关联的所有 Signal
}
```

CurateEvents Task 读取 `ctx._candidates` 而非 `ctx._events`，传入 LLM 时序列化为包含 contextHints 的 JSON。

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| CandidateBuilder 增加 Editorial Pipeline 延迟 | 所有 Rule 为纯计算（无 IO 无 LLM），估计总耗时 < 500ms |
| Memory JSON 文件损坏导致 Pipeline 崩溃 | `load()` 失败时降级为空 MemorySnapshot，Pipeline 继续执行 |
| diversity-rule 补入逻辑在 review tier 为空时无效果 | 不报错，候选池可能小于预期——是可接受的降级行为 |
| Rule 执行顺序依赖隐式约定 | 构造时注入顺序即执行顺序，BreakingRule 文档注明必须在 DiversityRule 之前 |

## Open Questions（已解决）

- ContextHints 以何种格式注入 LLM Curation prompt？**已解决**：`_contextHints` 字段附加到 CurateEvents 输入 JSON 的每条 event 上，curation prompt 新增说明引导 LLM 正确使用。
- Ranked View 中 score + boost 混合排序是否会导致低质量但高 boost 的候选胜出？**待验证**：Phase 2 可引入 boost 天花板或 boost/score 比例限制。
