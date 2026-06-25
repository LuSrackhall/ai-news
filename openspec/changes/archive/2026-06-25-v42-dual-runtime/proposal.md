## Why

v4.1 的单一 Daily Pipeline 把 RSS 采集和日报生成混在同一个生命周期里，导致：每次运行都是全量处理、无法增量采集、Repository 只是临时 JSON 文件、依赖 Claude Code Workflow 原语。v4.2 的目标是拆分为 Ingestion + Editorial 两个独立 Runtime，用 SQLite 替代 JSON，让 Repository 成为持续增长的结构化知识库。

## What Changes

- **拆分为 Ingestion Runtime + Editorial Runtime**：采集（持续/高频/无 LLM）和内容生产（定时/低频/LLM 密集）完全分离
- **SQLite Event Repository**：替代 JSON 文件，支持结构化查询（effective_at 窗口、实体、主题）
- **移除 Claude Code Workflow 依赖**：Runtime 是纯 Node.js，LLM 调用通过 InferenceService 抽象
- **时间语义模型**：effective_at + time_precision，解决 RSS 时间质量问题
- **增量处理**：content_hash UNIQUE + INSERT OR IGNORE，Ingestion 只处理新内容
- **Event Entity/Topic 关系表**：为 v4.3 知识图谱预留
- **ExtractEntities Task**：规则提取实体（regex + 实体表），Ingestion 管道新增
- **Skill 薄入口**：`/daily` → Editorial，`/run-ingestion` → Ingestion

## Capabilities

### New Capabilities
- `sqlite-repository`: SQLite Event Repository（events 表 + event_entities + event_topics + 索引）
- `ingestion-runtime`: 持续运行的采集管道（7 Task，无 LLM，增量写 SQLite）
- `editorial-runtime`: 定时运行的内容生产管道（7 Task，3 LLM，读 SQLite）
- `time-model`: 时间语义模型（effective_at + time_precision）

### Modified Capabilities
- `execution-runtime`: 移除 Claude Code Workflow 依赖，Runtime 改为纯 Node.js

## Impact

- **新增依赖**：better-sqlite3（原生 SQLite 绑定）
- **受影响代码**：scripts/runtime/（Host 改为纯 Node.js）、scripts/stores/ → scripts/repositories/ + scripts/read-models/（改用 SQLite）、scripts/tasks/（拆分为 ingestion/ + editorial/）
- **v4.1 产物**：视为废弃，不需要迁移
- **Skill 入口**：新增 `/run-ingestion` + `/run-editorial`，`/daily` 作为 Editorial 别名
