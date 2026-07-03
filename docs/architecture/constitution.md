# Architecture Constitution

> 项目最高层不变量。
> 以下规则是所有实现的硬约束——十年内不应修改。
> 修改必须通过 Architecture Review + ADR。

## Invariant 1: Event Immutability

Event 一旦由 Ingestion 写入，不允许被后续任何层修改。编辑判断产生的附加数据必须在 Event 之外的结构中承载，不得回写 Event。

## Invariant 2: Unidirectional Dependency

依赖方向单向向下：Application → Runtime → Domain → Infrastructure。下层绝不知晓上层。Domain Layer 承载全部业务规则和核心模型，不依赖任何 Runtime。

## Invariant 3: Determinism Before Probability

评分、排序、筛选、去重——必须确定性执行（不调 LLM）。选题、写作、改写——可以使用 LLM。确定性步骤与 LLM 步骤必须在不同的 Runtime 中执行。

## Invariant 4: LLM Boundary

LLM 可以对已有事实进行组织和表达。LLM 不可以修改、创造或删除事实。LLM 不参与 ranking 或 scoring 决策。LLM 不能引入事实库中不存在的信息。

## Invariant 5: Configuration Over Hard Code

Publication 是配置组合（EditorialStrategy + GenerationStrategy + RenderStrategy），不是代码分支。新增 Publication 不改 Runtime 核心代码。

## Invariant 6: Single Source of Truth

每个数据片段有且仅有一个权威来源。禁止在多个位置维护同一数据的副本。

---

*Version 3.0 · 2026-07-04*
