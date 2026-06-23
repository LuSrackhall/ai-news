## ADDED Requirements

### Requirement: PipelineRunner SHALL iterate phases and drive lifecycle

PipelineRunner 持有 phases 数组，按顺序执行每个 Phase 的生命周期方法：`shouldSkip` → `before` → `run` → `after`。PipelineRunner 统一补齐 `duration` 字段，统一捕获异常转为 `PhaseResult.fatal`。

#### Scenario: 正常执行所有 Phase
- **WHEN** 所有 Phase 返回 `PhaseResult.ok()`
- **THEN** PipelineRunner 依次执行 10 个 Phase，每个 Phase 的 `duration` 为该 Phase 的执行时长（ms），最终返回 `{ status: 'success', manifest }`

#### Scenario: Phase 抛出未处理异常
- **WHEN** 某个 Phase 的 `run(ctx)` 抛出异常
- **THEN** PipelineRunner 捕获异常，生成 `PhaseResult.fatal(err.message)`，将截至当前的 execution 落盘，返回 `{ status: 'fatal', phase, reason, manifest }`

#### Scenario: Phase 返回 fatal
- **WHEN** Phase 返回 `PhaseResult.fatal('no_raw_items')`
- **THEN** PipelineRunner 不再执行后续 Phase，落盘当前 execution，返回 `{ status: 'fatal', ... }`

#### Scenario: Phase 实现 shouldSkip
- **WHEN** `phase.shouldSkip(ctx)` 返回 `true`
- **THEN** PipelineRunner 跳过该 Phase（不调用 before/run/after），在 results 中记录 `{ phase: name, status: 'skipped' }`

### Requirement: PipelineContext SHALL expose five root namespaces

PipelineContext 由 `createPipelineContext({ date, workflowRuntime })` 构建，返回的对象只有 5 个顶层属性：`runtime`、`environment`、`services`、`stores`、`domain`。

#### Scenario: 构建 PipelineContext
- **WHEN** 调用 `createPipelineContext({ date: '2026-06-23', workflowRuntime })`
- **THEN** 返回的 ctx 包含 `runtime`、`environment`（含 date/config/workspace/clock）、`services`（含 agent/prompt/logger/metrics）、`stores`（含 assets/events/artifacts/execution）、`domain`（含 ranking/dedup/curation/generate/render/validate）

#### Scenario: Phase 不直接访问文件系统
- **WHEN** Phase 需要读取上一步的输出
- **THEN** Phase 通过 `ctx.stores.assets.load()` 或 `ctx.domain.ranking.scoreAll()` 获取，不出现 `readFileSync` 或 `join(OUTPUT_DIR, ...)` 调用

### Requirement: PhaseResult SHALL follow CI Pipeline conventions

PhaseResult 包含：`status`（ok/fatal/warn/skipped）、`inputs`、`outputs`、`metrics`、`artifacts`、`warnings`、`errors`、`duration`。预留字段 `hash/cacheHit/replayed` 在 v4.0 可省略或填 null。

#### Scenario: Phase 正常完成
- **WHEN** ScorePhase 完成评分
- **THEN** 返回 `PhaseResult.ok({ outputs: { count: 42 }, metrics: { auto: 30, review: 12 } })`，`duration` 由 PipelineRunner 补齐

#### Scenario: Phase 有非致命警告
- **WHEN** ValidatePhase 发现 1 个幻觉 URL 但整体通过
- **THEN** 返回 `PhaseResult.ok({ warnings: ['hallucinated url detected'], metrics: { ... } })`

### Requirement: Execution 模型 SHALL track PipelineRun

每次 pipeline 运行产生一个 PipelineRun 对象，包含 id、date、versions、时间戳、status、results[]、manifest。存储在 `ctx.stores.execution`。

#### Scenario: 成功运行
- **WHEN** pipeline 所有 Phase 成功
- **THEN** `execution.save(run)` 写入 `output/<date>/execution.json`，`run.status = 'success'`，`run.results` 包含每个 Phase 的 PhaseResult

#### Scenario: 中途失败
- **WHEN** Phase 5 返回 fatal
- **THEN** `execution.save(run)` 写入包含前 4 个 Phase 结果的 execution，`run.status = 'fatal'`

### Requirement: Workflow SHALL be a thin entry point

`ai-ribao-daily.js` 只做三件事：构建 ctx、调用 `pipeline.run(ctx)`、返回结果。不 import 任何业务模块（score/dedup/render），不操作文件系统。

#### Scenario: 正常启动
- **WHEN** 用户调用 `/ai-ribao-daily --date 2026-06-23`
- **THEN** workflow 构建 ctx → 构建 pipeline（含 phase 列表）→ 调 pipeline.run(ctx) → 返回 `{ status: 'success', manifest }`，workflow 代码不超过 55 行

#### Scenario: 增加新 Phase
- **WHEN** v4.1 需要新增 ClusterPhase
- **THEN** 在 workflow 中 import ClusterPhase 并添加到 phases 数组中，PipelineRunner 和其他 Phase 零修改
