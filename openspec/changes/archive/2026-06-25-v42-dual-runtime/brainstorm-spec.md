# v4.2 Dual Runtime — Ingestion + Editorial 分离设计

## Context

### 现状

v4.1 建立了 Execution Runtime 框架（Host → Runtime → Task → PolicyEngine → Repository），但仍然是一个单一的 Daily Pipeline：RSS 采集 → 评分 → 去重 → 选题 → 生成 → 归档，全部串行执行。

### 问题

1. **生命周期混淆** — RSS 采集（持续/高频）和日报生成（定时/低频）混在同一个 Pipeline 里，无法独立调度
2. **Claude Code Workflow 依赖** — Runtime 依赖 `phase()` / `agent()` / `log()` 原语，无法脱离 Claude Code 独立运行
3. **Repository 不是真正的数据源** — JSON 文件是临时产物，不支持结构化查询，365 天后变成文件管理噩梦
4. **每次运行都是全量** — 采集 500 条 → 评分 500 条 → 去重 500 条，无法增量处理

### 设计目标

> **把单一 Daily Pipeline 拆成两个独立 Runtime，共享 Execution Runtime 框架和 SQLite 数据层，但拥有不同的 ExecutionGraph 和调度方式。同时移除 Claude Code Workflow 依赖，让 Runtime 成为纯 Node.js 代码。**

核心洞察：**RSS 采集和日报生成不是一个生命周期。** 采集是持续的知识积累，日报是定时的内容生产。分开后，Repository 成为真正的数据源，支持"SELECT WHERE effective_at BETWEEN"查询。

## Goals / Non-Goals

**Goals（v4.2）：**
- 拆分为 Ingestion Runtime + Editorial Runtime
- SQLite 作为 Event Repository（better-sqlite3）
- 移除 Claude Code Workflow 依赖（Runtime 是纯 Node.js）
- Skill 作为薄入口（`/daily` → Editorial，`/run-ingestion` → Ingestion）
- Ingestion 增量处理（content_hash 去重 + INSERT OR IGNORE）
- 时间语义模型（effective_at + time_precision）
- Event Entity / Topic 关系表
- ExtractEntities Task（规则提取，不依赖 LLM）

**Non-Goals（明确排除）：**
- Event 聚类（v4.3）
- Knowledge Graph / 向量检索（v4.3+）
- DAG 并行调度（v4.3+）
- Learning Engine / 反馈闭环（v4.4+）
- 多 Pipeline（Weekly/Newsletter/Video）（v4.5）
- Webhook / Feed Push 触发（v4.3+）

## Decisions

### D1: 系统边界

```
IngestionRuntime  → SQLite Event Repository
EditorialRuntime  → SQLite Event Repository → output/<date>/
```

共享：Execution Runtime 框架 / SQLite / PolicyEngine+Rules / InferenceService / TaskRegistry

独立：ExecutionGraph / 调度方式 / 输出目标

### D2: 移除 Claude Code Workflow 依赖

Runtime 是纯 Node.js。LLM 调用通过 InferenceService 抽象（不绑定 Claude API）。日志通过 console.log。Phase 标记去掉（那是 Workflow 特有的）。

Skill 调用 `node scripts/run-ingestion.mjs` 或 `node scripts/run-editorial.mjs`。

### D3: SQLite Schema

```sql
CREATE TABLE events (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL,
  title         TEXT NOT NULL,
  summary       TEXT,
  url           TEXT,
  content_hash  TEXT NOT NULL UNIQUE,    -- 去重核心

  -- 时间语义模型
  published_at  TEXT,
  collected_at  TEXT NOT NULL,
  effective_at  TEXT NOT NULL,           -- Editorial 查询默认使用
  time_precision TEXT NOT NULL,          -- second/minute/hour/day/unknown

  -- 评分快照
  rank_total    REAL,
  rank_tier     TEXT,

  -- 来源
  source_name   TEXT,
  source_tier   INTEGER,
  source_url    TEXT,
  source_id     TEXT,

  -- 选题快照（Editorial 写入）
  curation_importance TEXT,
  curation_note       TEXT,

  -- 实体与主题
  entities      TEXT DEFAULT '[]',       -- JSON array
  topics        TEXT DEFAULT '[]',       -- JSON array
  cluster_id    TEXT,

  -- 审计
  asset_ids     TEXT DEFAULT '[]',
  metadata      TEXT DEFAULT '{}'
);

CREATE INDEX idx_events_effective ON events(effective_at);
CREATE INDEX idx_events_published ON events(published_at);
CREATE INDEX idx_events_rank ON events(rank_tier, rank_total);
CREATE INDEX idx_events_source ON events(source_name);
CREATE INDEX idx_events_source_id ON events(source_id);
CREATE INDEX idx_events_cluster ON events(cluster_id);

-- v4.2 关系表
CREATE TABLE event_entities (
  event_id  TEXT NOT NULL REFERENCES events(id),
  entity    TEXT NOT NULL,
  PRIMARY KEY (event_id, entity)
);

CREATE TABLE event_topics (
  event_id  TEXT NOT NULL REFERENCES events(id),
  topic     TEXT NOT NULL,
  PRIMARY KEY (event_id, topic)
);
```

### D4: 时间语义模型

```
effective_at = published_at ? published_at : collected_at
time_precision = 根据 published_at 的精度判断（second/minute/hour/day/unknown）
```

Ingestion 的 NormalizeAssets Task 负责计算。Editorial 永远按 `effective_at` 查询。

### D5: Ingestion Runtime 执行图

```
CollectAssets → NormalizeAssets → VerifyAssets → ExtractEntities → ScoreEvents → DedupEvents → StoreEvents
```

7 个 Task，全部确定性（无 LLM）。高频（每 5-30 分钟），增量处理。

| Task | 职责 |
|------|------|
| CollectAssets | 读 RSS feeds，产出 Asset[] |
| NormalizeAssets | 统一字段 + 计算 effective_at + time_precision |
| VerifyAssets | URL 可访问性检查 |
| ExtractEntities | 规则提取实体（regex + 实体表），写入 event_entities |
| ScoreEvents | policyEngine.execute('ranking')，写入 rank |
| DedupEvents | content_hash + 事件指纹 + 标题相似度 |
| StoreEvents | INSERT OR IGNORE 写入 SQLite |

### D6: Editorial Runtime 执行图

```
SelectEditorialWindow → CurateEvents → GenerateArticle → GenerateScript → RenderArtifacts → ValidateOutput → ArchiveOutput
```

7 个 Task，3 个 LLM（Curate + Generate×2）。低频（每天一次）。

| Task | 职责 |
|------|------|
| SelectEditorialWindow | `readModel.findByWindow(from, to)` 基于 effective_at |
| CurateEvents | inferenceService.run('curation') |
| GenerateArticle | inferenceService.run('article') |
| GenerateScript | inferenceService.run('script') |
| RenderArtifacts | policyEngine.execute('render') |
| ValidateOutput | policyEngine.execute('validate') |
| ArchiveOutput | 写 output/<date>/ 文件 |

### D7: Skill 入口

```
/daily          → Editorial Runtime（别名）
/run-ingestion  → Ingestion Runtime
/run-editorial  → Editorial Runtime
```

Skill 是薄入口，调用 `node scripts/run-*.mjs`。不包含业务逻辑。

### D8: 入口脚本

```js
// scripts/run-editorial.mjs（~30 行）
import { createSqliteDatabase } from './infrastructure/database.mjs'
import { createRuntime } from './runtime/runtime.mjs'
import { buildScope } from './infrastructure/scope.mjs'
import { editorialPipeline } from './pipelines/editorial.mjs'

const db = createSqliteDatabase()
const scope = buildScope(db)
const runtime = createRuntime(scope)
const result = runtime.execute(editorialPipeline)
console.log(JSON.stringify(result))
```

纯 Node.js，不依赖 Claude Code 原语。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| better-sqlite3 需要原生编译 | 选择 better-sqlite3 而非 sqlite3（更轻量、同步 API） |
| 从 JSON 迁移到 SQLite 有一次性成本 | v4.1 的 JSON 产物视为废弃，不需要迁移 |
| Ingestion 无 LLM，ExtractEntities 纯规则可能不够准 | v4.2 先用规则，v4.3 加 LLM 辅助 |
| 双 Runtime 增加运维复杂度 | 共享框架 + 共享 DB，实际复杂度低于单体 Pipeline |
