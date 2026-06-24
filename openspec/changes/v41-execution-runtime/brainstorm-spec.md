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

> **Runtime 只认识 Executable、ExecutionPlan、ExecutionContext。所有业务概念（Event、Article、Score、Dedup）都存在于 Executable 实现中，不存在于 Runtime 框架中。**

## Goals / Non-Goals

**Goals（v4.1）：**
- Host 抽象：Runtime 不绑定 Claude Code，可运行在 Node/CLI/GitHub Actions 上
- Runtime 执行引擎：接收 ExecutionPlan → 驱动 Executable 执行
- Executable 接口：Runtime 只认识 `execute(context) → ExecutionResult`
- ExecutableRegistry：字符串 ID → Executable 实例解析（依赖注入）
- ExecutionContext：Resources / Repository / ReadModel / Services / RuleEngine / UnitOfWork
- PipelineCompiler：声明式 Pipeline 定义 → ExecutionPlan
- RuleEngine：通用规则引擎（RuleSet / Rule），替代 v4.0 的 Policy
- InferenceProfile + InferenceService：LLM 调用配置与执行分离
- Repository（写）+ ReadModel（读）分离 + UnitOfWork 事务
- 移除所有 v3 兼容层（v3-compat adapter、v3-reader）

**Non-Goals（明确排除）：**
- DAG 调度 / 并行 Executable（v4.2）
- Event Cluster / Knowledge Graph（v4.2-4.3）
- 多 Pipeline（Weekly/Research/Newsletter）（v4.5）
- SQLite / S3 存储后端（v4.2+）
- Cache / Snapshot / Replay（v4.2+）
- Learning Engine / 反馈闭环（v4.4+）

## Decisions

### D1: 七层依赖链

```
Host → Runtime → ExecutionPlan → Executable
                                      ↓
                              ExecutionContext
                              ├── Resources
                              ├── Repository
                              ├── ReadModel
                              ├── Services
                              ├── RuleEngine
                              └── UnitOfWork
```

依赖单向向下。Executable 通过 ExecutionContext 获取所有依赖，不直接 import 任何模块。

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

### D3: Executable — Runtime 唯一认识的执行单元

```js
interface Executable {
  execute(context: ExecutionContext): Promise<ExecutionResult>
}
```

UseCase 是 Executable 的一种实现。未来可以有 WorkflowExecutable、BatchExecutable、ParallelExecutable、LoopExecutable。

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

Runtime 的返回值和各 Executable 的返回值使用同一结构。执行过程中的状态（重试次数、中间错误）全部收敛到此对象。

### D4: ExecutionPlan — 纯声明式执行意图

ExecutionPlan 是一组 ExecutionStep 的声明式描述。Pipeline 只是生成 Plan 的一种方式。**Plan 只做声明，不承载任何执行时状态** — 执行过程中的结果、重试次数、耗时、错误都只进入 ExecutionResult。Plan 可以被序列化、打印、diff、持久化。

```js
ExecutionStep {
  name: string
  executableId: string      // 字符串 ID，通过 ExecutableRegistry 解析
  condition: string | null   // 条件名称（可序列化）
  retry: number
  timeout: number | null
  depends: string[]          // v4.2+ DAG
}
```

**Executable 是工厂函数调用，不是 live 实例。** 图可以被序列化、打印、diff、persist。

### D5: ExecutableRegistry — 字符串 ID → 实例

```js
class ExecutableRegistry {
  register(id: string, ExecutableClass: Function): void
  resolve(id: string, ctx: ExecutionContext): Executable
}
```

`resolve(id, ctx)` 构造带依赖注入的实例。

### D6: ExecutionContext — 只读依赖集合（命名注入）

```js
ExecutionContext {
  host: Host
  resources: Resources                // date, runId, config, workspace, pipelineName, version
  repositories: { events, assets, artifacts }  // 写模型（CRUD）
  readModels: { events, assets, artifacts }    // 读模型（查询/聚合）
  services: { inference, metrics, cache }       // 外部能力
  ruleEngine: RuleEngine              // 规则引擎
  unitOfWork: UnitOfWork              // 事务管理
}
```

**使用命名注入而非数组：** `ctx.repositories.events.save()`、`ctx.readModels.events.history()`、`ctx.services.inference.run()`。依赖边界明确，适合类型系统和后续扩展。

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

### D8: RuleEngine + RuleSet + Rule — 注册表式规则引擎

RuleSet 通过注册表管理，不是枚举常量。新增规则集不需要改 Runtime，只改注册表。

```js
ruleEngine.execute('ranking', assets)    // 评分
ruleEngine.execute('cluster', events)    // 聚类
ruleEngine.execute('validate', output)   // 校验
ruleEngine.execute('recommend', items)   // 推荐（v4.4+）
```

每个 Rule 无状态、无 IO、纯函数：

```js
class AuthorityRule {
  name = 'authority'
  evaluate(input): { type: 'base'|'bonus', score: number }
}
```

以后加新规则：写一个 Rule class，注册到 RuleSet。RuleEngine、Executable、Pipeline 零修改。

### D9: Repository + ReadModel + UnitOfWork

- **Repository**：写模型，只负责 CRUD（save/load/delete）
- **ReadModel**：读模型，只负责查询（history/byEntity/timeline/search/statistics）
- **UnitOfWork**：事务管理，`begin()` / `commit()` / `rollback()`

JSON 文件实现下，commit() 是批量写。SQLite 下是 transaction。UseCase 不需要知道。

### D10: InferenceProfile + InferenceService

- **InferenceProfile**：配置对象（model / prompt / schema / examples / temperature / retry / validator / postProcessor）
- **InferenceService**：执行器，调用 host、做重试、做解析、做标准化

UseCase 中：`ctx.services.inference.run('article', variables)`。不直接拿 profile 自己执行。

### D11: PipelineCompiler — 声明式输入 → ExecutionPlan

Compiler **只做静态展开和校验**：将 Pipeline 声明（steps 数组）转换为 ExecutionPlan。不做执行期逻辑，不做依赖注入，不做重试，不做缓存。Runtime、Compiler、Executable 三者边界干净。

```js
const dailyPipeline = {
  name: 'daily',
  steps: [
    { executableId: 'CollectAssets', name: '采集', retry: 2 },
    { executableId: 'ScoreEvents', name: '评分' },
    // ...
  ],
}

const plan = compiler.compile(dailyPipeline)
const result = await runtime.execute(plan, ctx)
```

### D12: Workflow 入口（~30 行）

```js
const host = createClaudeHost({ phase, agent, log })
const ctx = createExecutionContext(host, { resources, repositories, readModels, services, ruleEngine, unitOfWork })
const registry = buildRegistry()
const runtime = createRuntime(host, registry)
return await runtime.execute(dailyPipeline, ctx)
```

Workflow 不知道有几个 Executable、不知道 Policy、不知道 Repository。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 抽象层级过高，v4.1 实现复杂度增大 | 先做最小骨架，不实现所有细节（如 UnitOfWork 的 JSON 实现只是批量写） |
| RuleEngine 引入额外间接层 | v4.1 先用简单实现（Rule[] 数组），不引入外部规则引擎框架 |
| ExecutableRegistry 增加启动复杂度 | registry.resolve() 只是 new + 注入，无反射/动态加载 |
| 从 v4.0 迁移工作量大 | v4.0 的 domain/store/service 逻辑可直接迁入 Policy/Repository/Service，不需要重写业务逻辑 |
| v3 兼容层移除后历史数据不可读 | 历史数据视为废弃；如需对比验证，使用 v4 在同日期重新生成 |
