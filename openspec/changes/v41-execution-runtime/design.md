## Context

v4.0 建立了 Pipeline Engine 骨架，但抽象层级不够。v4.1 要把 AI 日报的执行框架升级为通用 Execution Runtime。完整架构设计见 `brainstorm-spec.md`（13 个设计决策 D1-D13）。

**约束：**
- 运行时为 Claude Code Workflow（Host 实现），但 Runtime 层不绑定
- 零 npm 依赖
- v4.0 代码视为废弃，全新实现
- 先做最小骨架再逐步填充

## Goals / Non-Goals

**Goals:** 将 brainstorm-spec.md 的七层依赖链转化为可实现的模块边界和接口定义

**Non-Goals:** DAG 并行、知识图谱、Event 聚类、多 Pipeline、SQLite

## Decisions

### D1: 最小骨架实现策略

v4.1 不实现所有层的完整版本。优先级：

| 层 | v4.1 实现深度 |
|---|---|
| Runtime / ExecutionGraph / Task / ExecutionContext | 完整实现 |
| TaskRegistry | 完整实现（resolve 返回全新带 ctx 实例） |
| ExecutionSession | 最简实现（status + stepResults） |
| PolicyEngine | 最简实现（Policy[] 数组，execute('name', data)） |
| Repository / ReadModel | 最简实现（JSON 文件，store/remove/load/history） |
| UnitOfWork | 最简实现（JSON 下 = 批量写） |
| InferenceProfile + InferenceService | 完整实现（从 v4.0 agent.mjs 迁移） |
| Scope | 直接组装对象，不做动态解析 |

### D2: Task 数据组装原则

Task 负责数据组装（从 ReadModel 取数据、准备输入），Policy 只做纯计算。Policy 不碰 Repository / ReadModel / Service。

```js
// DedupTask 中
const today = ctx.scope.events.readModel.load()
const history = ctx.scope.events.readModel.history(14)
const result = ctx.scope.policyEngine.execute('dedup', { today, history })
await ctx.scope.events.repository.store(result.kept)
```

### D3: 目录结构

```
scripts/
├── runtime/                    # 框架层（零业务知识）
│   ├── host.mjs                # Host 接口
│   ├── runtime.mjs             # Runtime 执行引擎
│   ├── context.mjs             # ExecutionContext + Scope
│   ├── session.mjs             # ExecutionSession
│   ├── graph.mjs               # ExecutionGraph / ExecutionNode
│   ├── compiler.mjs            # GraphCompiler
│   ├── registry.mjs            # TaskRegistry
│   └── result.mjs              # ExecutionResult
│
├── hosts/
│   └── claude-host.mjs         # Claude Code Workflow 适配
│
├── pipelines/
│   ├── daily.mjs               # AI 日报 Pipeline 声明
│   └── index.mjs               # PipelineSet
│
├── tasks/                      # Task 实现（替代 v4.0 phases + usecases）
│   ├── collect-assets.mjs
│   ├── verify-assets.mjs
│   ├── score-events.mjs
│   ├── dedup-events.mjs
│   ├── curate-events.mjs
│   ├── generate-article.mjs
│   ├── generate-script.mjs
│   ├── render-artifacts.mjs
│   ├── validate-output.mjs
│   └── archive-output.mjs
│
├── policies/                   # Policy 实现（纯计算）
│   ├── ranking-policy.mjs
│   ├── dedup-policy.mjs
│   ├── validation-policy.mjs
│   └── render-policy.mjs
│
├── rules/                      # Rule 实现（纯函数）
│   ├── authority-rule.mjs
│   ├── timeliness-rule.mjs
│   ├── entity-weight-rule.mjs
│   ├── event-type-rule.mjs
│   ├── quantitative-rule.mjs
│   ├── academic-rule.mjs
│   ├── title-similarity-rule.mjs
│   └── event-fingerprint-rule.mjs
│
├── repositories/               # 写模型（store/remove）
│   ├── event-repository.mjs
│   ├── asset-repository.mjs
│   └── artifact-repository.mjs
│
├── read-models/                # 读模型（load/history/search）
│   ├── event-read-model.mjs
│   ├── asset-read-model.mjs
│   └── artifact-read-model.mjs
│
├── services/
│   ├── inference-service.mjs
│   └── inference-profiles/
│       ├── article-profile.mjs
│       ├── script-profile.mjs
│       └── curation-profile.mjs
│
├── infrastructure/             # 组装层
│   ├── scope.mjs               # buildScope()
│   └── policies.mjs            # buildPolicyEngine()
│
├── storage/
│   └── json-file-storage.mjs   # JSON 文件存储实现
│
├── config.mjs
└── test-runtime.mjs
```

### D4: Workflow 入口（~30 行）

```js
import { createClaudeHost } from './scripts/hosts/claude-host.mjs'
import { createRuntime } from './scripts/runtime/runtime.mjs'
import { buildTaskRegistry } from './scripts/runtime/registry.mjs'
import { graphCompiler } from './scripts/runtime/compiler.mjs'
import { buildScope } from './scripts/infrastructure/scope.mjs'
import { dailyPipeline } from './scripts/pipelines/daily.mjs'

export const meta = { name: 'ai-ribao-daily', description: 'AI 日报', phases: [{ title: '执行' }] }

const host = createClaudeHost({ phase, agent, log })
const date = (args && args.date) || new Date().toISOString().slice(0, 10)
const scope = buildScope(host, date)
const ctx = { host, resources: { date, runId: `run-${date}`, pipelineName: 'daily', version: 'v4.1', config: {}, workspace: '.' }, scope }
const registry = buildTaskRegistry()
const runtime = createRuntime(host, registry)
const session = runtime.execute(graphCompiler.compile(dailyPipeline), ctx)
return session.toResult()
```

## Risks / Trade-offs

- [抽象层级高] → 先做最小骨架，不实现所有细节
- [从 v4.0 全新构建] → 业务逻辑直接迁入 Policy/Rule，不需要重写
- [历史数据废弃] → 如需对比验证，使用 v4.1 在同日期重新生成
