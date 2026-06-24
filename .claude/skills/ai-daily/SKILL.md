---
name: ai-daily
description: AI 领域日报自媒体自动化。用户说"生成今日日报"或"/daily"时触发。Runtime 驱动的 10 阶段 pipeline：采集 → 验证 → 评分 → 去重 → 选题 → 生成 → 渲染 → 校验 → 归档。Skill 是薄入口，业务逻辑在 scripts/runtime/ + scripts/tasks/ + scripts/policies/。
---

# AI 日报

从 15+ 信源采集 AI 新闻，经评分、去重、选题后，生成日报文章和视频口播稿。

## 触发条件

- "生成今日日报"
- "采集今日 AI 新闻"
- "做一期 AI 日报"
- "/daily"

## 设计原则

> **Skill 是薄入口，Runtime 是厚核心。**

Skill 只做三件事：
1. 读取配置
2. 初始化 Runtime
3. 调用 `runtime.execute(graph, ctx)`

所有业务逻辑在 `scripts/` 中，Skill 不包含任何评分规则、渲染模板、Prompt 内容。

## 架构

```
/daily
  ↓
Skill（读配置 → 初始化 → 调用）
  ↓
Runtime（Host → Session → Graph → Task → Context）
  ↓
Tasks（10 个，每个调 Domain/Policy/Service）
  ↓
PolicyEngine（ranking/dedup/render/validate）
  ↓
Repository + ReadModel（JSON 文件存储）
```

### 核心文件

| 文件 | 职责 |
|------|------|
| `scripts/runtime/runtime.mjs` | Runtime 执行引擎 |
| `scripts/runtime/context.mjs` | ExecutionContext（Resources + Scope） |
| `scripts/pipelines/daily.mjs` | DailyPipeline 声明（10 个 steps） |
| `scripts/tasks/*.mjs` | 10 个 Task 实现 |
| `scripts/policies/*.mjs` | 4 个 Policy（ranking/dedup/render/validate） |
| `scripts/rules/*.mjs` | 8 个 Rule（纯函数） |
| `scripts/services/inference-service.mjs` | LLM 调用封装 |
| `scripts/config.mjs` | 信源/评分/权重配置 |

## 执行流程

### Phase 1: 初始化

```
1. 读取 scripts/config.mjs 获取信源配置
2. 构建 Host（createClaudeHost）
3. 构建 Scope（buildScope：Repository + ReadModel + PolicyEngine）
4. 构建 ExecutionContext（host + resources + scope）
5. 注册 Task（TaskRegistry.registerAll）
6. 编译 Pipeline（GraphCompiler.compile(dailyPipeline)）
```

### Phase 2: 执行 Pipeline

```
Runtime.execute(graph, ctx)
  ├── CollectAssets    → host.invoke（RSS 采集脚本）
  ├── VerifyAssets     → host.invoke（URL 验证脚本）
  ├── ScoreEvents      → policyEngine.execute('ranking')
  ├── DedupEvents      → policyEngine.execute('dedup')
  ├── CurateEvents     → inferenceService.run('curation')
  ├── GenerateArticle  → inferenceService.run('article')
  ├── GenerateScript   → inferenceService.run('script')
  ├── RenderArtifacts  → policyEngine.execute('render')
  ├── ValidateOutput   → policyEngine.execute('validate')
  └── ArchiveOutput    → 写磁盘 + 更新 index
```

### Phase 3: 检查产出

```
1. 检查 execution.json 的 status
2. 检查 article.md 结构完整性
3. 检查 script.md 时长（180-300s）
4. 检查 validation_passed
```

## 硬性检查点（Checkpoint）

### Checkpoint 1: 采集完成后

**必须检查：**
- [ ] raw_count > 0
- [ ] sources_ok >= 10
- [ ] 无连续 3 天失败的源

**如果失败：** 告知用户哪些源有问题，询问是否继续。

### Checkpoint 2: 选题完成后

**必须检查：**
- [ ] selected_count 在 8-15 之间
- [ ] 至少有 1 条 deep 级别
- [ ] 来源多样性（>= 3 个不同源）

**如果失败：** 告知用户选题结果，询问是否调整。

### Checkpoint 3: 校验完成后

**必须检查：**
- [ ] validation_passed = true
- [ ] article_chars > 2000
- [ ] script 总时长 180-300s

**如果失败：** 告知用户哪些校验未通过，询问是否重跑。

## 自检协议

每个 Task 产出后，执行自动检查：

| Task | 检查项 | 方式 |
|------|--------|------|
| CollectAssets | raw_count > 0, sources_ok >= 10 | 读 execution.json |
| VerifyAssets | valid > 0, removed < 50% | 读 execution.json |
| ScoreEvents | auto >= 5, events > 0 | 读 execution.json |
| DedupEvents | kept > 0, removed < 80% | 读 execution.json |
| CurateEvents | selected 8-15, 至少 1 deep | 读 curated.json |
| GenerateArticle | content 非空, hook 存在 | 读 article.json |
| GenerateScript | 总时长 180-300s | 读 script.json |
| RenderArtifacts | article_chars > 2000 | 读 execution.json |
| ValidateOutput | validation_passed = true | 读 execution.json |

**铁律：** 检查失败必须先修复（重跑 Task），再汇报给用户。

## 参考文档

| 文档 | 用途 | 何时读 |
|------|------|--------|
| `references/EDITORIAL.md` | 内容标准和写作风格 | 生成文章/口播稿前 |
| `references/QUALITY.md` | 质量标准和反模式 | 校验和自检时 |
| `scripts/config.mjs` | 信源和评分配置 | 初始化时 |

## 信源管理

编辑 `scripts/config.mjs` 的 `RSS_SOURCES` 数组。新增信源无需修改其他文件。

### 信源结构

```js
{
  id: 'new-source',
  name: '来源名称',
  url: 'https://example.com/rss',
  tier: 2,           // 1=官方, 2=权威媒体, 3=社区
  language: 'en',    // en 或 zh
  category: 'media', // official/academic/media/community
}
```

## 评分体系

详见 `scripts/config.mjs` 的 `SCORING` / `ENTITY_WEIGHTS` / `EVENT_TYPE_WEIGHTS`。

### 分级阈值

- auto >= 70: 自动入选
- review 55-69: LLM 复审
- skip < 55: 淘汰

## 团队结构（v4.2+）

当前 v4.1 使用单 agent 执行全部 Task。v4.2 可升级为 Team 模式：

```
Chief Editor（主 agent）
  ├── Collector Team（并行采集 + 验证）
  ├── Editor Team（选题 + 生成 + 渲染）
  └── Reviewer Team（独立校验，不参与生产）
```

Reviewer Team 是独立 agent，只接收"产出 + 清单"，报告 pass/fail + 证据。不参与生产。

## 扩展指南

### 新增信源
编辑 `scripts/config.mjs` 的 `RSS_SOURCES`。

### 调整评分
编辑 `scripts/config.mjs` 的 `SCORING` / `ENTITY_WEIGHTS`。

### 修改 Prompt
编辑 `prompts/v1/` 下的模板文件。

### 新增 Pipeline
创建 `scripts/pipelines/weekly.mjs`，定义 `steps` 数组。
