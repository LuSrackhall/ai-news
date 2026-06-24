## Why

v4.0 的 Pipeline Engine 方向正确，但抽象层级不够高：Phase 和 Domain 仍包含业务语言，Runtime 绑定 Claude Code Workflow，Store 混合了写操作和查询操作。继续在 v4.0 上堆功能，收益递减。v4.1 的目标是把 v4.0 从"AI 日报的执行框架"升级为"通用 Execution Runtime"，让日报、周报、研报、视频脚本都只是这个 Runtime 的不同输入。

## What Changes

- **新增 Host 抽象**：Runtime 不绑定 Claude Code，可运行在 Node/CLI/GitHub Actions 上
- **新增 Runtime 执行引擎**：接收 ExecutionGraph → 驱动 Task 执行，Runtime 只认识 Task / ExecutionGraph / ExecutionContext
- **新增 Task 接口**：替代 v4.0 的 Phase + Domain，Runtime 唯一认识的执行单元
- **新增 TaskRegistry**：字符串 ID → Task 实例解析（依赖注入，每次全新实例）
- **新增 ExecutionContext**：Resources + Scope（命名注入），避免 Service Locator 膨胀
- **新增 ExecutionSession**：执行会话状态记录，与 Runtime 执行职责分离
- **新增 GraphCompiler**：声明式 Pipeline 定义 → ExecutionGraph，只做静态展开和校验
- **新增 PolicyEngine**：注册表式规则引擎（Policy + Rule），替代 v4.0 的 Domain，Policy 只做纯计算不碰 IO
- **新增 InferenceProfile + InferenceService**：LLM 调用配置与执行分离
- **新增 Repository（写）+ ReadModel（读）+ UnitOfWork**：纯 CQRS 切分
- **移除 v4.0 的 Phase / Domain / Store / PipelineRunner / PipelineContext**
- **移除所有 v3 兼容层**

## Capabilities

### New Capabilities
- `execution-runtime`: Runtime 执行引擎、Host 抽象、ExecutionGraph、Task 接口、TaskRegistry、ExecutionContext、ExecutionSession、GraphCompiler
- `policy-engine`: PolicyEngine、Policy、Rule 三层注册表式规则引擎
- `data-access`: Repository（写）、ReadModel（读）、UnitOfWork（事务）纯 CQRS 架构
- `inference-service`: InferenceProfile（配置）+ InferenceService（执行器），LLM 调用与业务解耦
- `daily-pipeline`: AI 日报 Pipeline 定义（纯声明式 steps 数组），作为 Runtime 的第一个应用

### Modified Capabilities
（v4.0 的所有 capability 被 v4.1 替代，无增量修改）

## Impact

- **受影响代码**：`scripts/` 下整个目录结构重构（engine→runtime, domain→policies+rules, stores→repositories+read-models, phases→tasks）
- **运行时依赖**：仍然基于 Claude Code Workflow（Host 实现），但 Runtime 层不绑定
- **迁移策略**：v4.0 代码视为废弃，v4.1 全新实现，业务逻辑（评分/去重/渲染/校验）迁入 Policy/Rule
- **历史数据**：视为废弃；如需对比验证，使用 v4.1 在同日期重新生成
