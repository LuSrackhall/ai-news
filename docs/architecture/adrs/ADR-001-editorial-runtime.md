# ADR-001: Editorial Runtime

**Status:** `ACCEPTED` · **Date:** 2026-07-04

## Context

Ingestion Runtime 产出结构化的 Event 集合后，需要一套领域逻辑将它们组织为供 LLM 消费的候选池。早期做法是将所有 Event 直接喂给 LLM，但 500+ 事件时 LLM 的选题质量和一致性无法保证。

## Decision

将"编辑领域"建模为独立 Runtime，接在 Ingestion 之后、Generation 之前。Editorial Runtime 负责：

1. **Lane Dispatch** — 按编辑领域分发 Event
2. **Candidate Building** — 在每个 Lane 内通过确定性规则构建候选
3. **Editorial Merge** — 跨 Lane 合并为统一候选池
4. **Publication Assembly** — 应用 Publication 级别策略

Editorial Runtime 不创建、不修改 Event，不调用 LLM 做排序/评分。

## Consequences

- Event 的不可变性得到保证（不随时间流失）
- 确定性规则和 LLM 之间的边界清晰
- 各 Lane 可独立调试和优化
- 新增 Publication 只需配置 Lane + Rule 组合

## Alternatives Considered

- 在 Ingestion Runtime 内部增加编辑逻辑：被放弃，违反"Ingestion 不负责编辑判断"的宪法
- 直接扩展 Candidate Builder：被放弃，Candidate Builder 应定位为 Lane 内的 Service，不是顶层编排器
