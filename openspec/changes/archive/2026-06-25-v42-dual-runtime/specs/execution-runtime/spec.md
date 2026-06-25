## MODIFIED Requirements

### Requirement: Runtime SHALL be pure Node.js (no Claude Code Workflow dependency)

Runtime 不依赖 Claude Code 的 `phase()` / `agent()` / `log()` 原语。Host 接口保留，但实现改为纯 Node.js。

#### Scenario: LLM 调用
- **WHEN** InferenceService 调用 host.invoke(prompt, opts)
- **THEN** 通过 ANTHROPIC_API_KEY 环境变量调用 Claude API，不使用 Claude Code 的 agent() 原语

#### Scenario: 日志
- **WHEN** 任何模块调用 ctx.host.log(msg)
- **THEN** 输出到 console.log，不使用 Claude Code 的 log() 原语

#### Scenario: 入口脚本
- **WHEN** 执行 `node scripts/run-editorial.mjs`
- **THEN** 纯 Node.js 进程，不依赖 Claude Code 运行时
