## ADDED Requirements

### Requirement: DailyPipeline SHALL be a declarative step array

AI 日报 Pipeline 定义为纯声明式 steps 数组，通过 GraphCompiler 编译为 ExecutionGraph。

#### Scenario: Pipeline 定义
- **WHEN** dailyPipeline = { name: 'daily', steps: [...] }
- **THEN** steps 包含 10 个 node 声明：CollectAssets / VerifyAssets / ScoreEvents / DedupEvents / CurateEvents / GenerateArticle / GenerateScript / RenderArtifacts / ValidateOutput / ArchiveOutput

#### Scenario: 编译为 ExecutionGraph
- **WHEN** graphCompiler.compile(dailyPipeline)
- **THEN** 返回 ExecutionGraph，每个 node 的 taskId 对应 TaskRegistry 中的注册 ID

### Requirement: Task SHALL implement execute(ctx)

每个 Task 是一个 Executable，通过 `execute(ctx)` 调用。Task 负责数据组装（从 ReadModel 取数据），调用 PolicyEngine 做纯计算，通过 Repository 写入结果。

#### Scenario: ScoreEvents Task
- **WHEN** new ScoreEvents().execute(ctx)
- **THEN** 从 ctx.scope.assets.readModel.load() 取 assets → 调 ctx.scope.policyEngine.execute('ranking', assets) → 调 ctx.scope.events.repository.store(rankedEvents)

#### Scenario: DedupEvents Task
- **WHEN** new DedupEvents().execute(ctx)
- **THEN** 从 readModel 取 today + history → policyEngine.execute('dedup', data) → repository.store(kept)

### Requirement: Workflow entry SHALL be ~30 lines

`ai-ribao-daily.js` 只做：构建 Host → 构建 Scope → 构建 ExecutionContext → 构建 TaskRegistry → 创建 Runtime → execute(dailyPipeline, ctx) → 返回结果。

#### Scenario: 正常启动
- **WHEN** 用户调用 /ai-ribao-daily
- **THEN** workflow 代码不超过 35 行，不 import 任何业务模块（tasks/policies/rules）
