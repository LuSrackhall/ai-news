## ADDED Requirements

### Requirement: Runtime SHALL execute ExecutionGraph via Task

Runtime 只认识 Task、ExecutionGraph、ExecutionContext。Runtime 接收 Graph，通过 TaskRegistry 解析每个 node 的 taskId 为 Task 实例，按顺序驱动 `task.execute(ctx)`，统一补 duration，捕获异常转为 ExecutionResult.fatal。

#### Scenario: 正常执行
- **WHEN** ExecutionGraph 包含 10 个 nodes，所有 Task 返回 ok
- **THEN** Runtime 依次执行 10 个 Task，每个 Task 的 duration 为执行时长（ms），ExecutionSession.status = 'success'

#### Scenario: Task 抛出异常
- **WHEN** 某个 Task 的 execute(ctx) 抛出异常
- **THEN** Runtime 捕获异常，生成 ExecutionResult.fatal，ExecutionSession.status = 'fatal'，不再执行后续 Task

#### Scenario: Task 返回 fatal
- **WHEN** Task 返回 ExecutionResult.fatal
- **THEN** Runtime 记录结果后终止，不再执行后续 Task

### Requirement: Host SHALL abstract runtime environment

Host 是 Runtime 与外部世界的唯一接口。Runtime 不知道自己运行在 Claude Code / Node / CLI / GitHub Actions 上。

#### Scenario: Claude Host 实现
- **WHEN** 创建 ClaudeHost({ phase, agent, log })
- **THEN** host.log() 调用 log()，host.invoke() 调用 agent()，host.now() 返回 ISO timestamp

#### Scenario: Test Host 实现
- **WHEN** 在单元测试中使用 TestHost（mock log/invoke）
- **THEN** Runtime 代码零修改，只是注入不同的 Host

### Requirement: TaskRegistry SHALL resolve Task with context injection

TaskRegistry.register(id, TaskClass) 注册 Task 类。resolve(id, ctx) 每次返回全新实例（带 ctx 注入），不复用、不缓存。

#### Scenario: 注册并解析
- **WHEN** registry.register('ScoreEvents', ScoreEvents) 然后 registry.resolve('ScoreEvents', ctx)
- **THEN** 返回新的 ScoreEvents 实例，execute(ctx) 可正常调用

#### Scenario: 每次全新实例
- **WHEN** 两次 resolve 同一个 id
- **THEN** 返回两个不同的实例对象（=== 为 false）

### Requirement: ExecutionGraph SHALL be declarative

ExecutionGraph 只做声明，不承载任何执行时状态。可以被序列化、打印、diff、持久化。

#### Scenario: 序列化
- **WHEN** 创建 ExecutionGraph（含 nodes 数组）
- **THEN** JSON.stringify(graph) 不抛异常，JSON.parse 后可还原

### Requirement: ExecutionSession SHALL record execution state

Session 由 Runtime 创建和持有，记录 runId、时间戳、status、stepResults。Workflow 只拿最终结果。

#### Scenario: 成功运行
- **WHEN** 所有 Task 成功
- **THEN** session.status = 'success'，session.stepResults 包含每个 Task 的 ExecutionResult

#### Scenario: 中途失败
- **WHEN** Task 5 返回 fatal
- **THEN** session.status = 'fatal'，session.stepResults 包含前 5 个 Task 的结果
