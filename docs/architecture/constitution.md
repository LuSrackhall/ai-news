# Architecture Constitution

> 本文档定义项目最高层的不变量（Invariant）。
> 以下规则是所有实现的硬约束——十年内不应修改。

## Invariant 1: Event Immutability

Event（事实）一旦由 Ingestion 写入，不允许被后续任何层修改。编辑判断产生的附加数据（curation 标注、EditorialSignals）必须在 Event 之外的结构中承载，不得回写 Event。

## Invariant 2: Layer Separation

系统固定为四层，依赖方向单向向下：

```
Application Layer    — Publication 配置、业务策略
Runtime Layer        — 编排流水线（Ingestion / Editorial / Generation）
Domain Layer         — 核心模型与规则（Event / Candidate / Rule）
Infrastructure Layer — 存储、网络、外部服务
```

- 上层可以依赖下层，下层绝不知晓上层
- 同一层内的组件通过接口协作，不直接依赖实现
- Domain Layer 承载所有业务规则和核心模型，不依赖任何 Runtime

## Invariant 3: Determinism Boundary

确定性逻辑与生成逻辑必须在不同的 Runtime 中执行：

- 评分（scoring）、排序（ranking）、筛选（filtering）、去重（dedup）——**必须确定性**
- 选题（curation）、写作（writing）、摘要（summarization）——**可以使用 LLM**

确定性步骤不得调用 LLM。LLM 步骤不得参与评分、排序和筛选决策。

## Invariant 4: LLM Boundary

LLM 在整个系统中的角色是约束性的：

- LLM **可以对已有事实进行组织和表达**（选题、写作、改写）
- LLM **不可以修改、创造或删除事实**（Event 的 title、url、source 等字段）
- LLM **不参与 ranking 或 scoring 决策**
- LLM **不能引入事实库中不存在的信息**

## Invariant 5: Configuration > Hard Code

Publication 不是代码，而是配置组合。新增 Publication 不修改 Runtime 核心代码。

## Invariant 6: Single Source of Truth

每个数据片段有且仅有一个权威来源：

- Event → SQLite events 表
- Curation → curated.json（Pipeline 执行期间的 ctx 变量）
- Editorial Memory → editorial-memory.json
- Rule 配置 → config.mjs

禁止在多个位置维护同一数据的副本。

## Revision

本文档的不变量只能通过 Architecture Review 修改。修改必须以 ADR 形式提交，经过评审后更新 Constitution 版本号。

---

*Version 2.0 · 2026-07-04*
