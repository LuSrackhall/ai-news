# Glossary

> 项目统一术语表。所有文档、代码、讨论中的用词以此为基准。

## 核心概念

| 术语 | 定义 | 注意 |
|------|------|------|
| **Event** | Ingestion 产出的不可变事实。包含 title、url、source、entities 等字段。存储在 SQLite `events` 表。 | 不可修改——编辑判断不影响 Event。 |
| **Candidate** | Event 的编辑视图。由 Editorial Runtime 在 Pipeline 执行期间构建，包含 finalRank、contextHints、signals。不持久化。 | 临时性——生命周期限于单次 Pipeline 执行。 |
| **Signal** | Rule 的确定性输出。携带 phase、subtype、weight、source、reason。三条不变规则：不修改 Event、不互相覆盖（追加式合并）、可追溯（每一条 Signal 知道来自哪个 Rule）。 | Rule 不产出 rank，只产出 Signal。 |
| **Rule** | 确定性函数——输入 Event[]，输出 Signal[]。独立、无状态、可组合。Rule 之间不互相调用。 | 不调 LLM。业务规则属于 Domain 层。 |
| **Lane** | 一级编辑轨道抽象。在特定评价空间内组织 Event。互斥、独立、可配置。运行时不认识任何具体 Lane 类型。 | Lane 集合由 Publication 配置声明。 |
| **Publication** | 配置组合——EditorialStrategy + GenerationStrategy + RenderStrategy。不是代码分支。 | 新增 Publication 不改 Runtime 代码。 |

## 架构概念

| 术语 | 定义 | 注意 |
|------|------|------|
| **Runtime** | 执行层——编排确定性流水线。Ingestion / Editorial / Generation 三组职责分离。 | Runtime 负责编排，不负责业务规则。 |
| **Domain** | 业务模型层——承载 Event、Candidate、Rule 等核心模型。不依赖任何 Runtime。 | 业务规则在 Domain 里，不在 Runtime 里。 |
| **Infrastructure** | 技术实现——SQLite、文件存储、外部服务。 | Domain 不直接依赖 Infrastructure。 |
| **Artifact** | 最终输出——article.md、script.md、podcast.mp3 等。 | Artifact 类型可扩展（newsletter、RSS Feed、HTML 页面）。 |
| **Narrative** | LLM 生成的结构化内容——curated.json、article.json。介于 Candidate 和 Artifact 之间。 | LLM 的产品，不是事实。 |
| **EditorialStrategy** | Publication 的编辑策略配置——定义哪些 Lane 参与、使用什么 Rule 集合、MergePolicy。 | Publication 的核心差异点。 |

## 文件与数据概念

| 术语 | 定义 |
|------|------|
| **curated.json** | LLM curation 产出——从 Candidate Pool 中选出的最终条目。 |
| **article.json** | LLM 写作产出——结构化的日报文章 JSON。 |
| **article.md** | 渲染后的 Markdown 文章——最终面向用户的内容。 |
| **editorial-memory.json** | 跨天报道记忆——最近 7 天的 topEntities / topCategories。 |

---

*Version 1.0 · 2026-07-04*
