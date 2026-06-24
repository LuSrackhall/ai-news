# v4.1 Execution Runtime — 架构设计

## Context

### 现状

v4.0 建立了 Pipeline Engine 骨架（PipelineRunner / PipelineContext / Phase Interface / Domain Layer / Store Repository），AI 日报是第一个应用。v4.0 的方向正确，但抽象层级还不够高：

- Phase 和 Domain 仍然包含业务语言（AI Daily / Score / Dedup）
- Pipeline 硬编码了 Phase 顺序（workflow 直接 new 每个 Phase）
- Runtime 绑定了 Claude Code Workflow（ctx.runtime.llm.agent）
- Store 混合了写操作和查询操作
- 没有事务语义（多 Repository 写入无法保证一致性）

### 设计目标

> **构建一个通用的 Execution Runtime，让 AI 日报成为它的第一个应用，而非唯一应用。**

Runtime 自身不包含任何业务语言。未来无论是日报、周报、研报、Newsletter、视频脚本，还是 AI Agent 自动规划的执行图，都只是这个 Runtime 的不同输入。

核心设计原则：

> **Runtime 只认识 Task、ExecutionGraph、ExecutionContext。所有业务概念（Event、Article、Score、Dedup）都存在于 Task 实现中，不存在于 Runtime 框架中。**

## Goals / Non-Goals

**Goals（v4.1）：**
- Host 抽象：Runtime 不绑定 Claude Code，可运行在 Node/CLI/GitHub Actions 上
- Runtime 执行引擎：接收 ExecutionGraph → 驱动 Task 执行
- Task 接口：Runtime 只认识 `execute(context) → ExecutionResult`
- TaskRegistry：字符串 ID → Task 实例解析（依赖注入）
- ExecutionContext：Resources + Scope（Repository / ReadModel / Services / PolicyEngine / UnitOfWork）
- ExecutionSession：执行会话状态记录（与 Runtime 执行职责分离）
- GraphCompiler：声明式 Pipeline 定义 → ExecutionGraph
- PolicyEngine：注册表式规则引擎（Policy / Rule），替代 v4.0 的 Domain
- InferenceProfile + InferenceService：LLM 调用配置与执行分离
- Repository（写）+ ReadModel（读）分离 + UnitOfWork 事务
- 移除所有 v3 兼容层（v3-compat adapter、v3-reader）

**Non-Goals（明确排除）：**
- DAG 调度 / 并行 Task（v4.2）
- Event Cluster / Knowledge Graph（v4.2-4.3）
- 多 Pipeline（Weekly/Research/Newsletter）（v4.5）
- SQLite / S3 存储后端（v4.2+）
- Cache / Snapshot / Replay（v4.2+）
- Learning Engine / 反馈闭环（v4.4+）

## Decisions

### D1: 依赖链

```
Host → Runtime → ExecutionSession → ExecutionGraph → Task
                                                         ↓
                                                 ExecutionContext
                                                 ├── Resources
                                                 └── Scope
                                                     ├── events (Repository + ReadModel)
                                                     ├── assets (Repository + ReadModel)
                                                     ├── inference (Service)
                                                     ├── policyEngine (PolicyEngine)
                                                     └── unitOfWork (UnitOfWork)
```

依赖单向向下。Task 通过 ExecutionContext 获取所有依赖，不直接 import 任何模块。

### D2: Host — 宿主抽象

Host 是 Runtime 与外部世界的唯一接口。Runtime 永远不知道自己运行在什么环境上。

```js
interface Host {
  log(message: string): void
  invoke(prompt: string, opts: InvokeOpts): Promise<any>
  metric(key: string, value: any): void
  now(): string
  elapsed(startMs: number): number
}
```

v4.0 的 `ctx.runtime.workflow.phase()` / `ctx.runtime.llm.agent()` 全部收进 Host。

### D3: Task — Runtime 唯一认识的执行单元

```js
interface Task {
  execute(context: ExecutionContext): Promise<ExecutionResult>
}
```

UseCase 是 Task 的一种。未来可以有 RetryTask、ConditionalTask、CompositeTask、LoopTask、ParallelTask。`Task.execute(ctx)` 语义自然，不绑定 DDD。

### D3.5: ExecutionResult — 统一执行结果

```js
ExecutionResult {
  stepName: string
  status: 'ok' | 'fatal' | 'warn' | 'skipped'
  outputs: object | null      // 本步骤产出的数据摘要
  metrics: object | null      // 量化指标（count, ratio, ...）
  errors: string[]            // 错误详情
  duration: number | null     // ms，由 Runtime 统一补
}
```

Runtime 的返回值和各 Task 的返回值使用同一结构。执行过程中的状态（重试次数、中间错误）全部收敛到此对象。

### D4: ExecutionGraph — Runtime 唯一认识的执行结构

Runtime 不认识 Pipeline、Plan、Workflow。Runtime 只认识 ExecutionGraph。Pipeline/Workflow/AgentPlan 都通过 GraphCompiler 编译成同一个 Graph。Runtime 永远 `Runtime.execute(graph)`，不知道 graph 来自哪里。

**Graph 只做声明，不承载任何执行时状态** — 可以被序列化、打印、diff、持久化。

```js
ExecutionNode {
  name: string
  taskId: string           // 字符串 ID，通过 TaskRegistry 解析
  condition: string | null // 条件名称（可序列化）
  retry: number
  timeout: number | null
  depends: string[]        // v4.2+ DAG
}
```

### D5: TaskRegistry — 字符串 ID → Task 实例

```js
class TaskRegistry {
  register(id: string, TaskClass: Function): void
  resolve(id: string, ctx: ExecutionContext): Task
}
```

`resolve(id, ctx)` 构造带依赖注入的实例。

### D6: ExecutionContext — 只读依赖集合（通过 Scope 注入）

ExecutionContext 自身保持稳定（只有 3 个字段），所有依赖通过 Scope 注入。避免演化成 Service Locator。

```js
ExecutionContext {
  host: Host
  resources: Resources       // date, runId, config, workspace, pipelineName, version
  scope: Scope               // 所有业务依赖的容器
}
```

```js
Scope {
  events: { repository, readModel }    // 写 + 读
  assets: { repository, readModel }
  artifacts: { repository, readModel }
  inference: InferenceService
  policyEngine: PolicyEngine
  unitOfWork: UnitOfWork
  metrics: MetricsService
}
```

使用方式：`ctx.scope.events.repository.store(event)`、`ctx.scope.inference.run('article', vars)`。以后增加依赖只改 Scope，ExecutionContext 零修改。

### D7: Resources — 只读运行时数据

从 Host 分离出的运行时数据，**只读，不演化为第二个 Host**。核心字段：

```js
Resources {
  date: string           // 目标日期（如 '2026-06-24'）
  runId: string          // 运行唯一 ID
  pipelineName: string   // 当前 Pipeline 名称（如 'daily'）
  version: string        // Runtime 版本
  config: object         // 静态配置（sources, weights, thresholds, ...）
  workspace: string      // 工作目录路径
}
```

Resources 只承载"本次运行需要知道的数据"，不承载能力（invoke/log/metric 是 Host 的事）。

### D8: PolicyEngine + Policy + Rule — 注册表式规则引擎

PolicyEngine 管理 Policy 注册表。每个 Policy 包含一组 Rule。`Policy` 是行为，`Rule` 是组成。

```js
policyEngine.execute('ranking', assets)     // 评分
policyEngine.execute('cluster', events)     // 聚类
policyEngine.execute('validate', output)    // 校验
policyEngine.execute('recommend', items)    // 推荐（v4.4+）
```

每个 Rule 无状态、无 IO、纯函数：

```js
class AuthorityRule {
  name = 'authority'
  evaluate(input): { type: 'base'|'bonus', score: number }
}
```

以后加新 Policy：写一个 Policy class + 若干 Rule，注册到 PolicyEngine。Runtime、Task、Graph 零修改。

### D9: Repository + ReadModel + UnitOfWork — 纯 CQRS

- **Repository**：只负责修改状态（`store(entity)` / `remove(id)`），不暴露 `load`/`find`/`search`
- **ReadModel**：只负责查询状态（`history()` / `byEntity()` / `timeline()` / `search()` / `statistics()`）
- **UnitOfWork**：事务管理，`begin()` / `commit()` / `rollback()`

JSON 文件实现下，commit() 是批量写。SQLite 下是 transaction。Task 不需要知道。

### D10: InferenceProfile + InferenceService

- **InferenceProfile**：配置对象（model / prompt / schema / examples / temperature / retry / validator / postProcessor）
- **InferenceService**：执行器，调用 host、做重试、做解析、做标准化

Task 中：`ctx.scope.inference.run('article', variables)`。不直接拿 profile 自己执行。

### D11: GraphCompiler — 声明式输入 → ExecutionGraph

Compiler **只做静态展开和校验**：将 Pipeline 声明（steps 数组）转换为 ExecutionGraph。不做执行期逻辑，不做依赖注入，不做重试，不做缓存。Runtime、Compiler、Task 三者边界干净。

```js
const dailyPipeline = {
  name: 'daily',
  steps: [
    { taskId: 'CollectAssets', name: '采集', retry: 2 },
    { taskId: 'ScoreEvents', name: '评分' },
    // ...
  ],
}

const graph = graphCompiler.compile(dailyPipeline)
const session = runtime.execute(graph, ctx)
```

### D12: ExecutionSession — 执行会话（状态记录）

Runtime 负责执行，Session 负责记录。两个完全不同的职责。

```js
ExecutionSession {
  runId: string
  startedAt: ISO timestamp
  finishedAt: ISO timestamp
  status: 'running' | 'success' | 'fatal' | 'partial'
  stepResults: ExecutionResult[]
  metrics: object
  logs: string[]
}
```

以后 Replay、Resume、Trace、Visualization、Web UI、Execution History 全部依赖 Session。Runtime 不需要增加任何状态。

### D13: Workflow 入口（~30 行）

```js
const host = createClaudeHost({ phase, agent, log })
const ctx = createExecutionContext(host, { resources, scope })
const registry = buildTaskRegistry()
const runtime = createRuntime(host, registry)
const session = runtime.execute(graphCompiler.compile(dailyPipeline), ctx)
return session.toResult()
```

Workflow 不知道有几个 Task、不知道 Policy、不知道 Repository。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 抽象层级过高，v4.1 实现复杂度增大 | 先做最小骨架，不实现所有细节（如 UnitOfWork 的 JSON 实现只是批量写） |
| PolicyEngine 引入额外间接层 | v4.1 先用简单实现（Policy[] 数组），不引入外部规则引擎框架 |
| TaskRegistry 增加启动复杂度 | registry.resolve() 只是 new + 注入，无反射/动态加载 |
| 从 v4.0 迁移工作量大 | v4.0 的 domain/store/service 逻辑可直接迁入 Policy/Repository/Service，不需要重写业务逻辑 |
| 历史数据视为废弃 | 如需对比验证，使用 v4 在同日期重新生成 |
