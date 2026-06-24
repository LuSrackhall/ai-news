# AI 日报 (ai-ribao)

基于 **Execution Runtime v4.1** 的 AI 内容智能平台。每日从 15+ 信源采集、评分、去重、选题、生成日报文章和视频口播稿。

## 架构

```
Host → Runtime → ExecutionSession → ExecutionGraph → Task
                                                       ↓
                                               ExecutionContext
                                               ├── Resources
                                               └── Scope
                                                   ├── events (Repository + ReadModel)
                                                   ├── assets (Repository + ReadModel)
                                                   ├── artifacts (Repository + ReadModel)
                                                   ├── inference (InferenceService)
                                                   ├── policyEngine (PolicyEngine)
                                                   └── unitOfWork (UnitOfWork)
```

**七层依赖链，单向向下。** Task 通过 ExecutionContext 获取所有依赖，不直接 import 任何模块。

### Pipeline 流程

```
CollectAssets → VerifyAssets → ScoreEvents → DedupEvents → CurateEvents
                                                              ↓
                          GenerateArticle → GenerateScript → RenderArtifacts → ValidateOutput → ArchiveOutput
```

### 核心设计原则

- **Task 负责数据组装，Policy 只做纯计算** — Policy 不碰 IO、不碰 Repository
- **Repository（写）+ ReadModel（读）** — 纯 CQRS
- **PolicyEngine 注册表式** — 新增 Policy/Rule 不改 Runtime
- **InferenceProfile 配置 + InferenceService 执行** — LLM 调用与业务解耦
- **Runtime 只认识 Task / ExecutionGraph / ExecutionContext** — 零业务语言

## 快速开始

```bash
# 生成今日日报
/ai-ribao-daily

# 指定日期
/ai-ribao-daily --date=2026-06-24
```

## 目录结构

```
scripts/
├── runtime/                    # 框架层（零业务知识）
│   ├── host.mjs                # Host 接口
│   ├── runtime.mjs             # Runtime 执行引擎
│   ├── context.mjs             # ExecutionContext
│   ├── session.mjs             # ExecutionSession
│   ├── graph.mjs               # ExecutionGraph
│   ├── compiler.mjs            # GraphCompiler
│   ├── registry.mjs            # TaskRegistry
│   └── result.mjs              # ExecutionResult
├── hosts/claude-host.mjs       # Claude Code Workflow 适配
├── pipelines/daily.mjs         # DailyPipeline 声明
├── tasks/                      # Task 实现（10 个）
├── policies/                   # Policy 实现（4 个）
├── rules/                      # Rule 实现（8 个）
├── repositories/               # 写模型（3 个）
├── read-models/                # 读模型（3 个）
├── services/                   # InferenceService + Profiles
├── infrastructure/             # Scope + PolicyEngine 组装
├── storage/json-file-storage.mjs
├── config.mjs                  # 信源/评分/权重配置
├── collect-rss.mjs             # RSS 采集脚本
├── verify-urls.mjs             # URL 验证脚本
└── test-runtime.mjs            # 测试（13 项）
```

## 扩展指南

### 新增 Policy
创建 `scripts/policies/my-policy.mjs`，在 `infrastructure/policies.mjs` 中注册。

### 新增 Rule
创建 `scripts/rules/my-rule.mjs`，在 Policy 构造函数中注入。

### 新增 Task
创建 `scripts/tasks/my-task.mjs`，在 workflow 中 `registry.registerAll()` 注册。

### 新增 Pipeline
创建 `scripts/pipelines/weekly.mjs`，定义 `steps` 数组即可。

## 测试

```bash
node scripts/test-runtime.mjs
```

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v4.1 | 2026-06-24 | Execution Runtime：Host/Task/PolicyEngine/Repository 七层架构 |
| v4.0 | 2026-06-23 | Pipeline Engine（已废弃） |
| v3 | 2026-06-22 | 8 阶段混合 Pipeline（已废弃） |
