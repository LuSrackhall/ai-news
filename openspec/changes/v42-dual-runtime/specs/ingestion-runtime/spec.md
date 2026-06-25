## ADDED Requirements

### Requirement: Ingestion Runtime SHALL run as pure Node.js

Ingestion 通过 `node scripts/run-ingestion.mjs` 运行，不依赖 Claude Code Workflow 原语。

#### Scenario: 手动运行
- **WHEN** 执行 `node scripts/run-ingestion.mjs`
- **THEN** 执行 7 个 Task（Collect→Normalize→Verify→Extract→Score→Dedup→Store），结果写入 SQLite

#### Scenario: 定时运行
- **WHEN** 通过 cron 每 5 分钟执行
- **THEN** 每次运行增量处理新内容，已存在的 Event 被 INSERT OR IGNORE 跳过

### Requirement: Ingestion SHALL process incrementally

Ingestion 只处理新内容，不重复处理已入库的 Event。

#### Scenario: 重复 RSS 条目
- **WHEN** 同一条 RSS 条目在两次运行中都被采集到
- **THEN** 第一次运行入库，第二次运行被 content_hash UNIQUE 约束跳过

### Requirement: ExtractEntities SHALL use rule-based extraction

ExtractEntities 使用 regex + 实体表提取实体，不依赖 LLM。

#### Scenario: 提取已知实体
- **WHEN** Event title 包含 "OpenAI"
- **THEN** 'OpenAI' 被写入 event_entities 表

#### Scenario: 提取未知实体
- **WHEN** Event title 不包含任何已知实体
- **THEN** event_entities 表无新增记录，不报错
