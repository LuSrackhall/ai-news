## Context

AI 日报 Pipeline v3 的架构设计已在 `brainstorm-spec.md` 中完整定义（5 节：Runtime 边界、PipelineContext/Phase 接口、Schema、Domain Layer、迁移路径）。本文档聚焦于 **实现层面的技术决策**，补充 brainstorm-spec 未展开的细节。

**约束：**
- 运行时为 Claude Code Workflow（phase/agent/log 原语可用）
- 零 npm 依赖（保持 v3 的约束）
- v3 文件不修改、不删除
- 新增代码全部在 `scripts/engine/` / `scripts/phases/` / `scripts/domain/` / `scripts/stores/` / `scripts/adapters/`

## Goals / Non-Goals

**Goals:**
- 将 brainstorm-spec 的架构设计转化为可直接实现的模块边界和接口定义
- 明确每个模块的文件位置、导出接口、依赖关系
- 确定错误处理、日志、测试策略

**Non-Goals:**
- 不重复 brainstorm-spec 已确定的架构决策（直接引用）
- 不涉及 v4.1+ 的实现细节

## Decisions

### D1: 模块导出模式 — 工厂函数，不用 class

所有 domain / store / service 统一使用工厂函数模式：`export function createXxxDomain(ctx) { return { ... } }`，不使用 class。

**理由：** 工厂函数天然支持依赖注入（ctx 作为参数），不需要 `new` + constructor，更函数式，测试时 mock 更简单。v3 现有模块（score/dedup/render/validate）已经是函数式风格，保持一致。

### D2: PipelineContext 构建方式 — 单一工厂函数 + 分层组装

```js
export function createPipelineContext({ date, workflowRuntime }) {
  const environment = createEnvironment(date, config)
  const services = createServices(environment, workflowRuntime)
  const stores = createStores(environment)
  const domain = createDomain(stores, services)

  return { runtime: workflowRuntime, environment, services, stores, domain }
}
```

每一层（environment → services → stores → domain）的工厂函数独立可测。

### D3: Phase 基类 vs 无基类 — 无基类，纯对象

Phase 不需要基类或 interface 注解。每个 Phase 就是一个导出 `{ name, run(ctx) }` 的对象，可选实现 `shouldSkip / before / after`。

```js
export class ScorePhase {
  name = '评分'
  async run(ctx) { ... }
}
```

PipelineRunner 通过 `phase.run(ctx)` 调用，不检查 interface，duck typing 即可。

### D4: Store 文件格式 — 单文件 per date，结构化 JSON

```
output/<date>/assets.json      ← Asset[]
output/<date>/events.json      ← Event[]
output/<date>/artifacts.json   ← { article: ArticleArtifact, script: ScriptArtifact }
output/<date>/execution.json   ← PipelineRun
```

Store 内部用 `readFileSync` / `writeFileSync`，但对外只暴露 `save/load/history` 方法。v4.1 换 SQLite 时只改 Store 内部实现。

**理由：** 保持和 v3 相同的目录结构，方便双跑对比，也方便 git 追踪。

### D5: 错误处理策略 — PhaseResult.fatal 逐级上报

- Phase 内部 try/catch，捕获后返回 `PhaseResult.fatal(reason)`
- PipelineRunner 捕获未处理异常，转为 `PhaseResult.fatal`
- Fatal 时 PipelineRunner 把截至当前的 execution 落盘（不丢观测数据）
- 不使用 throw 向上传播（除了 programming error）

### D6: LLM 调用封装 — ctx.services.agent 包装 Claude Code agent()

```js
// scripts/services/agent.mjs
export function createAgentService(runtime) {
  return {
    async call(prompt, opts = {}) {
      return runtime.llm.agent(prompt, opts)
    },
    async generate(prompt, schema, opts = {}) {
      const result = await runtime.llm.agent(prompt, { ...opts, schema })
      // JSON 解析兜底 + 重试（从 v3 workflow 的 parseJsonFallback 迁移）
      const parsed = typeof result === 'object' ? result : parseJsonFallback(String(result))
      if (!parsed && opts.retryOnFail !== false) {
        // 重试一次，缩短 prompt
        const retryResult = await runtime.llm.agent(prompt.slice(0, 15000), { ...opts, schema })
        return typeof retryResult === 'object' ? retryResult : parseJsonFallback(String(retryResult))
      }
      return parsed
    },
  }
}
```

Domain 通过 `ctx.services.agent.generate(prompt, schema)` 调用，不直接碰 `ctx.runtime.llm.agent`。

### D7: 测试策略 — 扩展 test-modules.mjs

v3 的 `test-modules.mjs`（172 行，23 个测试）继续保留。v4 的测试新增在 `scripts/test-modules-v4.mjs`，覆盖：
- Store save/load/history 单元测试
- Domain ranking/dedup/render/validate 单元测试（用固定输入对比预期输出）
- v3-compat adapter 转换测试（用真实 v3 产物）
- PhaseResult 构建测试

不需要外部测试框架，保持 v3 的 `assert` 风格。

## Risks / Trade-offs

- [Duck typing Phase 接口] → 没有编译时检查，Phase 遗漏 `run()` 方法会在运行时才发现 → 缓解：PipelineRunner 启动时校验每个 phase 有 `run` 方法
- [单文件 JSON 存储] → 大量数据后文件读写变慢 → 缓解：v4.0 数据量小（日均 <1MB），v4.1 上 SQLite
- [parseJsonFallback 重试逻辑在 agent service 中] → 重试策略和 LLM 调用耦合 → 缓解：v4.1 可抽成独立 retry middleware

## Migration Plan

详见 `brainstorm-spec.md` §5（7 个 Wave + 双跑对比 + 一步切换）。

实现顺序：Wave 0（engine/stores）→ Wave 1（schema/adapter）→ Wave 2（纯规则 domain）→ Wave 3（LLM domain）→ Wave 4（phase 模块）→ Wave 5（新 workflow）→ Wave 6（对比验证）。
