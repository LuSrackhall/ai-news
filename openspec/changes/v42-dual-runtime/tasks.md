## 1. SQLite 基础设施

- [ ] 1.1 安装 better-sqlite3 依赖（`npm install better-sqlite3`）
- [ ] 1.2 创建 `scripts/infrastructure/database.mjs`：createSqliteDatabase()，建表 + 索引 + WAL mode
- [ ] 1.3 创建 `scripts/repositories/sqlite-event-repository.mjs`：store/storeBatch（INSERT OR IGNORE）
- [ ] 1.4 创建 `scripts/read-models/sqlite-event-read-model.mjs`：findByWindow/findByEntity/findByTopic/existsByHash

## 2. 时间语义模型

- [ ] 2.1 创建 `scripts/domain/time-model.mjs`：computeEffectiveTime(publishedAt, collectedAt) + detectPrecision()
- [ ] 2.2 在 NormalizeAssets Task 中调用 computeEffectiveTime

## 3. Ingestion Runtime

- [ ] 3.1 创建 `scripts/tasks-ingestion/collect-assets.mjs`：读 RSS feeds，产出 Asset[]
- [ ] 3.2 创建 `scripts/tasks-ingestion/normalize-assets.mjs`：统一字段 + 计算 effective_at + time_precision
- [ ] 3.3 创建 `scripts/tasks-ingestion/verify-assets.mjs`：URL 可访问性检查
- [ ] 3.4 创建 `scripts/tasks-ingestion/extract-entities.mjs`：规则提取实体（regex + ENTITY_WEIGHTS 表），写入 event_entities
- [ ] 3.5 创建 `scripts/tasks-ingestion/score-events.mjs`：调 policyEngine.execute('ranking')
- [ ] 3.6 创建 `scripts/tasks-ingestion/dedup-events.mjs`：content_hash + 事件指纹 + 标题相似度
- [ ] 3.7 创建 `scripts/tasks-ingestion/store-events.mjs`：INSERT OR IGNORE 写入 SQLite + event_entities + event_topics
- [ ] 3.8 创建 `scripts/pipelines/ingestion.mjs`：IngestionPipeline 声明（7 个 steps）
- [ ] 3.9 创建 `scripts/run-ingestion.mjs`：入口脚本（~30 行，纯 Node.js）

## 4. Editorial Runtime

- [ ] 4.1 创建 `scripts/tasks-editorial/select-editorial-window.mjs`：readModel.findByWindow(from, to)
- [ ] 4.2 创建 `scripts/tasks-editorial/curate-events.mjs`：inferenceService.run('curation')
- [ ] 4.3 创建 `scripts/tasks-editorial/generate-article.mjs`：inferenceService.run('article')
- [ ] 4.4 创建 `scripts/tasks-editorial/generate-script.mjs`：inferenceService.run('script')
- [ ] 4.5 创建 `scripts/tasks-editorial/render-artifacts.mjs`：policyEngine.execute('render')
- [ ] 4.6 创建 `scripts/tasks-editorial/validate-output.mjs`：policyEngine.execute('validate')
- [ ] 4.7 创建 `scripts/tasks-editorial/archive-output.mjs`：写 output/<date>/ 文件
- [ ] 4.8 创建 `scripts/pipelines/editorial.mjs`：EditorialPipeline 声明（7 个 steps）
- [ ] 4.9 创建 `scripts/run-editorial.mjs`：入口脚本（~30 行，纯 Node.js，支持 --date 参数）

## 5. Scope 改造

- [ ] 5.1 修改 `scripts/infrastructure/scope.mjs`：buildScope 接收 db 实例，注入 SQLite Repository + ReadModel
- [ ] 5.2 修改 `scripts/infrastructure/policies.mjs`：buildPolicyEngine 不变（Policy 不依赖存储）

## 6. Host 改造

- [ ] 6.1 创建 `scripts/hosts/node-host.mjs`：纯 Node.js Host 实现（invoke 调 Claude API，log 调 console.log）
- [ ] 6.2 修改 `scripts/services/inference-service.mjs`：接收 host 参数而非依赖 workflowRuntime

## 7. Skill 入口

- [ ] 7.1 修改 `.claude/skills/ai-daily/SKILL.md`：添加 /run-ingestion 和 /run-editorial 说明
- [ ] 7.2 创建 `.claude/skills/ai-daily/references/INGESTION.md`：Ingestion 运维文档

## 8. 测试

- [ ] 8.1 创建 `scripts/test-sqlite.mjs`：SQLite 建表 + store/load/query 测试
- [ ] 8.2 创建 `scripts/test-ingestion.mjs`：Ingestion 管道测试（mock RSS 数据 → SQLite）
- [ ] 8.3 创建 `scripts/test-editorial.mjs`：Editorial 管道测试（mock SQLite 数据 → output/）
- [ ] 8.4 端到端运行 Ingestion（真实 RSS → SQLite）
- [ ] 8.5 端到端运行 Editorial（SQLite → output/<date>/）

---

## Post-Implementation Workflow

After completing ALL tasks above, follow this sequence strictly:

1. **Verify**: Run `/opsx:verify` to produce verify.md
2. **User Acceptance**: Present change summary, ask user to confirm
3. **Merge**: After user accepts, merge to main
4. **Archive**: Run `/opsx:archive` on main
5. **Cleanup**: Remove worktree
