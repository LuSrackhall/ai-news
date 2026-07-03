# Ingestion Runtime

> Ingestion Runtime 负责从外部采集事实（Event），经过验证、规范化、聚类、评分后存储到 SQLite。
>
> 本文档是 `constitution.md` 中 Ingestion Runtime 职责的扩展。

## 职责边界

| 职责 | 不负责 |
|------|--------|
| RSS 采集、RSSHub 池 | 编辑判断、内容生成 |
| 内容归一化和噪音过滤 | 写作、播客合成 |
| URL 验证、实体提取 | Publication 配置 |
| 事件聚类和去重 | LLM 调用 |
| 评分和排序 | 用户界面 |
| 存储到 SQLite | |

## 数据产出

Ingestion Runtime 产出的核心数据是 `Event`，存储在 `events` 表中。每个 Event 包含：

- 基础事实（title、url、summary、publishedAt）
- 来源信息（source_name、source_tier）
- 评分快照（rank_total、rank_tier）
- 实体和主题（entities、topics）
- 聚类归属（cluster_id）
- 编辑领域提示（category——未来可升级为 `editorialDomain`）

## 与 Editorial Runtime 的关系

Ingestion → Event → Editorial：这是单向数据流。Editorial Pipeline 在启动时通过 `EventReadModel.findByWindow()` 读取 Ingestion 写入的 Event，不直接访问 Ingestion 的写路径。

---

*Version 1.0 · 2026-07-04*
