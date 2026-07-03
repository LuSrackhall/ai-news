# ADR-003: Publication Composition

**Status:** Accepted · **Date:** 2026-07-04

## Context

随着 Editorial Runtime 成形，Publication（如 AI 日报、国际日报、技术周报）应如何接入？如果每个 Publication 都需要修改核心代码修改，架构没有达到"可扩展"的目标。

## Decision

Publication 定义为配置组合，不是代码分支：

```
Publication = EditorialStrategy + PromptSet + RenderPolicy
EditorialStrategy = LaneSet + RuleSet + MergeConfig
```

Publication 在 Runtime 启动时通过配置注册，不需要修改 Editorial Runtime 核心。

## Consequences

- 新增 Publication = 新增配置，不修改代码
- 不同的 Publication 可以共享 Lane（如 AI 日报和机器人日报都使用 Research Lane）
- Editorial Runtime 可作为一个平台部署，由配置驱动

## Alternatives Considered

- 每个 Publication 独立实现 Editorial Pipeline：被放弃，大量重复代码
- Publication 参数化现有 Pipeline：被放弃，参数过多时仍然不清晰

## Future

Phase 3 可引入 Publication Registry，支持运行时动态注册/注销 Publication 和基于模板的 Publication 定义。
