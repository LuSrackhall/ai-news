## Why

AI 日报 Pipeline v3 方向正确（Pipeline 化、LLM 只做语义、JSON→Renderer 分离），但编排文件已膨胀至 553 行，业务逻辑与调度、IO、manifest 构建混杂在一起，继续堆功能收益递减。v4 的目标是把 v3 从"能跑的脚本"升级为"可演化的内容智能运行时（Content Intelligence Runtime）"，让 AI 日报成为这个运行时的第一个应用，而非唯一应用。

## What Changes

- **新增 PipelineRunner**：workflow 只负责构建 ctx + 启动 pipeline（~50 行），Phase 调度由 PipelineRunner 管理，增减 Phase 不改 workflow
- **新增 PipelineContext（DI Container）**：Phase 通过 `ctx.domain.*` / `ctx.stores.*` / `ctx.services.*` 访问所有依赖，不直接 import 任何外部实现
- **新增 Phase 接口（含生命周期）**：`shouldSkip / before / run / after`，返回标准 PhaseResult；PipelineRunner 统一补齐 duration、捕获异常
- **新增知识对象三层抽象**：Asset（原始输入）→ Event（理解后的知识）→ Artifact（渠道化输出），v4.0 为 `1 Asset = 1 Event`
- **新增 Domain Layer**：ranking / dedup / curation / generate / render / validate 六个 domain 模块，业务规则与 Phase 编排解耦
- **新增 Store Repository**：assets / events / artifacts / execution 四个 store，Repository 语义（save/load/history），v4.0 JSON 文件实现，v4.1 可换 SQLite
- **新增 Execution 模型**：PipelineRun + PhaseExecution 追踪每次运行的完整状态，支持 partial/fatal/success
- **新增 v3 兼容 Adapter**：v4 可读取 v3 历史产物（只读兼容），14 天后可移除
- **重构现有 Phase 实现**：从 workflow 内联代码块迁移为独立 Phase 模块，调 Domain 而非直接操作文件系统
- **合并重复代码**：`collect-rss.mjs` 的 `computeImpactScore` 与 `score.mjs` 的评分逻辑合并进 `ranking` domain
- **v3 文件零侵入**：新代码全部放新目录，v3 的 `scripts/` 下原始模块不修改、不删除

## Capabilities

### New Capabilities
- `pipeline-engine`: PipelineRunner、PipelineContext（DI Container）、Phase 接口、PhaseResult、Execution 模型、v3/v4 兼容 Adapter、新 workflow 入口
- `knowledge-model`: Asset / Event / Artifact 三层 schema 定义，contentHash 计算规则，v3→v4 数据转换
- `store-repository`: AssetStore / EventStore / ArtifactStore / ExecutionStore 的 Repository 接口与 JSON 文件实现
- `domain-layer`: ranking / dedup / curation / generate / render / validate 六个 domain 模块，从 v3 的 score.mjs / dedup.mjs / render-*.mjs / validate-output.mjs 迁移并重组

### Modified Capabilities
（无现有 spec 需要修改，v3 文件保持原样）

## Impact

- **受影响代码**：`ai-ribao-daily.js`（完全重写）、`scripts/` 下新增 `engine/` / `phases/` / `domain/` / `stores/` / `adapters/` 子目录；v3 原始模块保留不动
- **运行时依赖**：仍然基于 Claude Code Workflow（phase/agent/log 原语），不引入新 npm 依赖
- **迁移风险**：v3 产物格式变化（snake_case → camelCase）通过 adapter 缓冲；双跑 3-5 天对比验证后才切换入口
- **配置影响**：`config.mjs` 迁移期间不修改；需改时两边同时验证
