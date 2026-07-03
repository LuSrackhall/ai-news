# ADR-000: Why Runtime Layer Exists

**Status:** `ACCEPTED` · **Date:** 2026-07-04

## Context

最早的系统设计是 Agent Workflow：Agent 从 RSS 采集到文章生成全链路执行。这很快暴露出几个问题：（1）LLM 对同一批事件的选择每次不一致；（2）评分、去重、聚类等需要确定性的操作不应该调用 LLM；（3）管线各步骤之间缺乏明确的接口契约。

## Decision

引入 Runtime Layer 作为 Ingestion 和 Editorial 的抽象。确定性与非确定性逻辑分离：

```
确定性：Ingestion Runtime（采集 → 评分 → 去重 → 存储）
确定性：Editorial Runtime 的规则部分（排序 → 筛选 → 合并）
非确定性：Editorial Runtime 的 LLM 部分（选题 → 写作）
非确定性：Generation Runtime（表达 → 渲染）
```

## Consequences

- Pipeline 的每一步都有明确的输入/输出类型
- 确定性部分可测试、可重放、可调参
- LLM 只在其边界内运作，不侵入确定性流程
- 未来新增 Publication 不需要修改 Runtime 实现

## Alternatives Considered

- **单 Agent 端到端**：被放弃，因为不可测试、不可控
- **纯规则系统**：被放弃，因为缺乏 LLM 的内容质量和多样性
