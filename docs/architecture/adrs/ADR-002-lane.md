# ADR-002: Lane Model

**Status:** `ACCEPTED` · **Date:** 2026-07-04

## Context

Editorial Pipeline 将所有 Event 在同一个编辑空间中排序和筛选。当 Event 来源多样化（学术论文、行业新闻、政策公告等）时，异构信息的价值无法在单一排序空间中公平比较。不同领域的信息需要独立的评价空间。

## Decision

引入 **Lane（编辑轨道）** 作为一级抽象。Event 根据 `editorialDomain` 字段归属一个主 Lane；各 Lane 独立构建候选；Editorial Merge 跨 Lane 合并。

Runtime 不认识任何具体 Lane 类型。Lane 是接口级别的抽象——具体有哪些 Lane 由 Publication 的 EditorialStrategy 配置决定，不在 Runtime 核心代码中硬编码。Lane ID 是稳定字符串，Runtime 不对其取值做内建假设。

### Lane 原则

1. **互斥性**：一个 Event 有且仅有一个主 Lane
2. **独立性**：Lane 之间不共享状态、不互相调用
3. **可配置性**：具体 Lane 集合由 Runtime Configuration 定义，不是硬编码
4. **零下限**：某天某个 Lane 的候选池可以为空——Merge 不为其填充

### Domain 与 Lane 的关系

`editorialDomain` 是 Event 的属性（在 Ingestion 阶段由 EntityExtraction + EventTypeRule 共同确定），Lane 是 Runtime 的编排单元。两者一一映射，但 Lane 是运行时概念，Domain 是数据模型概念。

## Consequences

- 各 Lane 内部可以使用现有的 CandidateBuilder + Rule Pipeline
- 各 Lane 可独立调优规则，不影响其他 Lane
- 新增 Lane 只需要新增配置 + 对应规则集，不改 Runtime 核心
- 需要为 editorialDomain 字段设计判定逻辑（当前可从 EventType + entities 推导）

## Alternatives Considered

- **降低 arXiv 评分权重**：治标不治本，同一空间的异构问题仍然存在
- **为 arXiv 设置单独配额**：固定配额与"不为均衡"的宪法冲突
