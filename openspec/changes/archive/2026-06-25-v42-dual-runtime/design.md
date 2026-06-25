## Context

v4.1 的 Execution Runtime 框架（Host → Runtime → Task → ExecutionContext）是正确的，但绑死在 Claude Code Workflow 上，且单一 Daily Pipeline 混淆了采集和内容生产的生命周期。v4.2 要在保留框架的前提下：拆分两个 Runtime、换 SQLite、移除 Workflow 依赖。

## Goals / Non-Goals

**Goals:** Ingestion + Editorial 分离、SQLite Repository、纯 Node.js Runtime、时间语义模型、增量处理

**Non-Goals:** Event 聚类、知识图谱、DAG、Learning Engine、多 Pipeline

## Decisions

### D1: Runtime 改为纯 Node.js

移除对 Claude Code `phase()` / `agent()` / `log()` 的依赖。Host 接口保留，但实现改为：
- `invoke(prompt, opts)` → 调用 Claude API（通过环境变量 ANTHROPIC_API_KEY）
- `log(msg)` → `console.log`
- `metric(key, value)` → 内存记录

入口脚本：`node scripts/run-editorial.mjs` 或 `node scripts/run-ingestion.mjs`（~70 行，含 TaskRegistry 注册 + scope 组装）

### D2: better-sqlite3 作为存储

选择 better-sqlite3 而非 sqlite3：
- 同步 API（更简单，不需要 async/await 包装）
- 更轻量
- 性能更好（WAL mode）

### D3: Scope 组装改为接收 db 实例

```js
// v4.1
const scope = buildScope(host, date)

// v4.2
const db = createSqliteDatabase()
const scope = buildScope(db, host)
```

Store / ReadModel 都通过 `db` 实例访问 SQLite。

### D4: Task 分为两个 Registry

```js
const ingestionRegistry = new TaskRegistry()
ingestionRegistry.registerAll({ CollectAssets, NormalizeAssets, VerifyAssets, ExtractEntities, ScoreEvents, DedupEvents, StoreEvents })

const editorialRegistry = new TaskRegistry()
editorialRegistry.registerAll({ SelectEditorialWindow, CurateEvents, GenerateArticle, GenerateScript, RenderArtifacts, ValidateOutput, ArchiveOutput })
```

### D5: NormalizeAssets 计算 effective_at

```js
function computeEffectiveTime(publishedAt, collectedAt) {
  if (publishedAt && publishedAt !== 'unknown') {
    return { effective_at: publishedAt, time_precision: detectPrecision(publishedAt) }
  }
  return { effective_at: collectedAt, time_precision: 'unknown' }
}
```

## Risks / Trade-offs

- [better-sqlite3 原生编译] → 选择 better-sqlite3（比 sqlite3 更易编译）
- [移除 Workflow 依赖后 LLM 调用方式变化] → InferenceService 抽象层不变，只改 Host 实现
- [v4.1 JSON 产物废弃] → 不迁移，v4.2 重新采集
