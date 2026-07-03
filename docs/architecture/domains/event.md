# Event Domain

> Event 是 Ingestion Runtime 产出的核心数据模型，代表一条经过验证的事实。
> Event 具有不可变性——Editorial 和 Generation 不修改 Event。

## 属性

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| type | string | 事件类型（news / paper / release） |
| title | string | 标题 |
| summary | string | 摘要 |
| url | string | 原文链接 |
| contentHash | string | 内容哈希（去重键） |
| publishedAt | string | 发布时间 |
| collectedAt | string | 采集时间 |
| effectiveAt | string | 有效时间（用于时间窗口过滤） |
| rank | object | 评分快照（totalScore / tierLabel / factors） |
| source | object | 来源信息（name / tier / url） |
| entities | string[] | 提取的实体列表 |
| topics | string[] | 主题标签 |
| clusterId | string | 聚类归属 |
| category | string | 当前分类（未来升级为 editorialDomain） |

## 不变性

Event 一旦写入 SQLite，不应被后续 Pipeline 修改。编辑判断产生的附加数据（如 curation 标注）应放在 Event 之外的结构中（如 Candidate）。

---

*Version 1.0 · 2026-07-04*
