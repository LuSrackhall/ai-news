# Architecture Constitution

> 项目最高层不变量（Invariants）。
> 所有架构、代码与设计必须遵守本文件。
> 修改本文件必须通过 Architecture Review + ADR。

---

## Invariant 1: Event Immutability

Event 一旦由 Ingestion 写入，不得被后续任何层修改。编辑判断、评分、过滤结果必须以附加结构承载，不得回写 Event 本体。

## Invariant 2: Unidirectional Dependency

依赖方向严格单向向下：上层依赖下层的抽象，下层不得感知上层存在。Domain 层承载全部业务规则与核心模型，不依赖任何 Runtime 或 Infrastructure 的实现。

## Invariant 3: LLM Boundary

LLM 仅用于：
- 内容生成（Generation）
- 文本表达与优化

LLM 不得参与：
- 评分（Scoring）和排序（Ranking）
- 过滤（Filtering）
- 结构性决策（Structural Decisions）
- 修改或创造事实

## Invariant 4: Single Source of Truth

Event 是唯一事实源。所有派生数据（Candidate、Signals、Rankings、Editorial Metadata）必须可追溯至 Event，但不得反向影响 Event。

## Invariant 5: Deterministic Editorial Logic

Editorial 层的所有规则（Rule、Signal、Filter、Rank）必须满足：
- 输入确定，输出确定
- 不依赖 LLM
- 不依赖随机性（除显式 seed 控制的场景）

## Invariant 6: Configuration over Code

Publication、Lane、Prompt、RenderPolicy 等策略必须通过配置组合定义，不得通过 Runtime 分支逻辑硬编码。

## Invariant 7: Runtime is Orchestration Only

Runtime 层只负责调度（orchestration）、数据流编排（pipeline）、上下文传递。不得包含业务规则、编辑逻辑、评分逻辑。业务规则属于 Domain 层。

---

*Version 4.0 · 2026-07-04*
