## 1. 基础设施 — Engine 框架

- [x] 1.1 创建 `scripts/engine/phase-result.mjs`：实现 `PhaseResult.ok/fatal/warn/skipped` 静态方法，字段包含 status/inputs/outputs/metrics/warnings/errors/duration
- [x] 1.2 创建 `scripts/engine/execution.mjs`：实现 `buildRun(ctx, results, startedAt, status)` 函数，生成 PipelineRun 对象（id/date/versions/timestamps/status/results/manifest）
- [x] 1.3 创建 `scripts/engine/context.mjs`：实现 `createPipelineContext({ date, workflowRuntime })`，组装 runtime/environment/services/stores/domain 五个 root namespace
- [x] 1.4 创建 `scripts/services/agent.mjs`：实现 `createAgentService(runtime)`，封装 `call()` 和 `generate()` 方法，`generate` 内含 parseJsonFallback + 一次重试逻辑
- [x] 1.5 创建 `scripts/services/prompt.mjs`：实现 `createPromptService(environment)`，迁移 workflow 的 `loadPrompt()` 和 `loadExamples()`
- [x] 1.6 创建 `scripts/services/logger.mjs`：实现 `createLoggerService(runtime)`，封装 `info/warn/error` 调用 `runtime.log()`
- [x] 1.7 创建 `scripts/engine/pipeline.mjs`：实现 PipelineRunner，持有 phases 数组，驱动 shouldSkip/before/run/after 生命周期，统一补 duration，捕获异常，fatal 时落盘 execution

## 2. Store Repository

- [x] 2.1 创建 `scripts/stores/assets.mjs`：实现 AssetStore，提供 `save(items)` / `load()` / `append(newItems)`，JSON 文件读写 `output/<date>/assets.json`
- [x] 2.3 创建 `scripts/stores/events.mjs`：实现 EventStore，提供 `save(events)` / `load()` / `history(days)`，`history` 遍历最近 N 天，支持 v3 格式自动检测
- [x] 2.4 创建 `scripts/stores/artifacts.mjs`：实现 ArtifactStore，提供 `save(type, artifact)` / `load(type)` / `loadMarkdown(type)`，存储在 `output/<date>/artifacts.json`
- [x] 2.5 创建 `scripts/stores/execution.mjs`：实现 ExecutionStore，提供 `save(pipelineRun)`，写入 `output/<date>/execution.json`

## 3. 数据模型与兼容层

- [x] 3.1 在 `scripts/engine/schemas.mjs` 中定义 Asset/Event/Artifact 数据结构（纯对象 schema，含字段类型注释和 contentHash 计算规则）
- [x] 3.2 创建 `scripts/engine/adapters/v3-compat.mjs`：实现 `adaptV3CuratedToEvents(v3Curated)` 和 `adaptV3ArticleToArtifact(v3Article)`，处理字段映射（summary_zh→summary 等）和异常防御
- [x] 3.3 创建 `scripts/engine/adapters/v4-compat.mjs`：实现 `adaptEventsToV3Curated(events)`，供需要 v3 格式的工具读取

## 4. Domain — 纯规则

- [x] 4.1 创建 `scripts/domain/ranking.mjs`：从 `score.mjs` + `collect-rss.mjs` 的 `computeImpactScore` 合并，实现 `scoreAll(assets)` / `classify(scoredAssets)` / `buildEvents(scoredAssets)`，消除评分逻辑重复
- [x] 4.2 创建 `scripts/domain/dedup.mjs`：从 `dedup.mjs` 迁移，去掉 `outputDir` 参数，改为 `run(events)` 内部通过 `ctx.stores.events.history(14)` 获取历史
- [x] 4.3 创建 `scripts/domain/render.mjs`：合并 `render-article.mjs` + `render-script.mjs`，实现 `article(content, context)` / `script(content)`
- [x] 4.4 创建 `scripts/domain/validate.mjs`：从 `validate-output.mjs` 迁移，实现 `run(articleArtifact, scriptArtifact, curatedEvents)`，继承 8 项内容质量检查 + 一致性检查

## 5. Domain — LLM 编排

- [x] 5.1 创建 `scripts/domain/curation.mjs`：从 workflow Phase 4 代码提取，实现 `select(candidates)`，封装 prompt 加载 + agent.generate + 结果校验
- [x] 5.2 创建 `scripts/domain/generate.mjs`：从 workflow Phase 5 代码提取，实现 `article()` / `script(articleContent)`，返回 `{ content, meta }` 结构（meta 含 eventIds/model/promptVersion/inputHash/retryCount）

## 6. Phase 模块

- [x] 6.1 创建 `scripts/phases/collect.mjs`：CollectPhase，直接调 `ctx.services.agent.call()` 执行 `node scripts/collect-rss.mjs`，写入 `ctx.stores.assets.save()`
- [x] 6.2 创建 `scripts/phases/verify.mjs`：VerifyPhase，读 `ctx.stores.assets.load()`，调 agent 执行 `node scripts/verify-urls.mjs`，写回 `ctx.stores.assets.save(validItems)`
- [x] 6.3 创建 `scripts/phases/score.mjs`：ScorePhase，调 `ctx.domain.ranking.buildEvents()`，写入 `ctx.stores.events.save()`
- [x] 6.4 创建 `scripts/phases/dedup.mjs`：DedupPhase，调 `ctx.domain.dedup.run()`，写回 `ctx.stores.events.save(deduped)`
- [x] 6.5 创建 `scripts/phases/curate.mjs`：CuratePhase，调 `ctx.domain.curation.select()`，写回 `ctx.stores.events.save(curated)`
- [x] 6.6 创建 `scripts/phases/generate-article.mjs`：GenerateArticlePhase，调 `ctx.domain.generate.article()`，写入 `ctx.stores.artifacts.save('article', ...)`
- [x] 6.7 创建 `scripts/phases/generate-script.mjs`：GenerateScriptPhase，调 `ctx.domain.generate.script()`，写入 `ctx.stores.artifacts.save('script', ...)`
- [x] 6.8 创建 `scripts/phases/render.mjs`：RenderPhase，调 `ctx.domain.render.article/script()`，写回 `ctx.stores.artifacts.save()` 的 rendered 层
- [x] 6.9 创建 `scripts/phases/validate.mjs`：ValidatePhase，调 `ctx.domain.validate.run()`，返回 PhaseResult 含校验结果
- [x] 6.10 创建 `scripts/phases/archive.mjs`：ArchivePhase，读取 artifacts + events + execution，写磁盘文件（article.md/script.md/article.json/script.json），更新 output/index.json

## 7. 新 Workflow 入口

- [x] 7.1 重写 `ai-ribao-daily.js`（~50 行）：构建 ctx → `pipeline.run(ctx)` → 返回结果，不 import 任何业务模块
- [x] 7.2 复制为 `ai-ribao-daily-v4.js`（双跑期间 v4 用临时名，v3 保持原名）

## 8. 测试与验证

- [x] 8.1 创建 `scripts/test-modules-v4.mjs`：Store save/load/history 单元测试、Domain ranking/dedup/render/validate 单元测试、v3-compat adapter 转换测试（用真实 v3 产物）、PhaseResult 构建测试
- [x] 8.2 运行 `node scripts/test-modules.mjs` 确认 v3 测试不受影响
- [ ] 8.3 端到端运行 v4 workflow（用 `--date` 参数指定日期），对比 v3 产物：candidates 数量差异 < 5%、curated 重叠率 > 90%、article.md 字数差异 < 20%、schema validation pass rate 一致

---

## Post-Implementation Workflow

After completing ALL tasks above, follow this sequence strictly:

1. **Verify**: Run `/opsx:verify` to produce verify.md
2. **User Acceptance**: Present change summary, ask user to confirm the problem is solved
3. **Merge**: After user accepts, go to main branch and merge (must ask user)
4. **Archive**: Run `/opsx:archive` on main
5. **Cleanup**: `git worktree remove .worktrees/change/v4-cie-architecture`

**Iteration**: If user does not accept, analyze the issue and recommend:
fix in place / new change / git reset + stash / git reset / abandon.
