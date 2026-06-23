# AI Daily v4 — Content Intelligence Runtime 架构设计

## Context

### 现状

AI 日报 Pipeline v3 是一个基于 Claude Code Workflow 的 8 阶段混合流水线，总代码量 ~2,894 行（不含 deprecated/test/docs）。核心编排文件 `ai-ribao-daily.js`（553 行）是一个串行代码块，直接 import 业务模块（score/dedup/render/validate），直接操作文件系统（readFileSync/writeFileSync），通过共享可变 manifest 对象传递状态。

v3 的方向是正确的：Pipeline 化、LLM 只负责语义任务、JSON→Renderer 输出分离、Prompt 版本化。但已经到了"该抽象、该拆层"的阶段，继续在原 Workflow 里堆功能收益递减。

### v3 的核心问题

1. **Workflow 太胖** — 553 行编排文件同时承担调度、IO、JSON 解析、重试、prompt 加载、manifest 构建
2. **共享可变状态** — manifest 对象一路 mutate，Phase 之间隐式耦合
3. **IO 耦合** — 所有 Phase 直接 `join(OUTPUT_DIR, ...)` 拼路径，无法替换存储后端
4. **缺少数据模型抽象** — Pipeline 处理的是 News item（平铺 JSON），缺少 Event / Asset / Artifact 的分层
5. **评分逻辑重复** — `collect-rss.mjs` 和 `score.mjs` 各有一套 impactScore / bonusScore 实现

### 设计目标

> **v3 解决的是"能跑"，v4 要解决的是"能长期稳定演化"。**

v4 不是"AI 日报 2.0"，而是一个 **Content Intelligence Runtime（内容智能运行时）**。AI 日报只是它的第一个应用。核心设计原则：

> **系统处理的不是文件，不是新闻，不是 Markdown，也不是 Prompt；系统处理的是知识对象（Knowledge Objects）及其生命周期。**

- **Asset** 是原始知识
- **Event** 是经过理解后的知识
- **Artifact** 是面向不同渠道表达后的知识

Pipeline 的职责不是"生成日报"，而是让知识对象在各个阶段不断演化，并保证每一步都可追踪、可重放、可缓存、可验证。

## Goals / Non-Goals

**Goals（v4.0）：**
- PipelineRunner：workflow 只负责构建 ctx + 启动 pipeline，Phase 调度由 PipelineRunner 管理
- PipelineContext（DI Container）：Phase 通过 ctx 访问所有依赖，不直接 import 任何外部实现
- Phase Interface（含生命周期）：`shouldSkip/before/run/after`，返回标准 PhaseResult
- Event 数据模型：建立 Asset→Event→Artifact 三层抽象，v4.0 为 `1 Asset = 1 Event`
- Domain Layer：业务规则（ranking/dedup/curation/generate/render/validate）独立于 Phase
- ManifestBuilder / Execution Model：PipelineRun + PhaseExecution 追踪运行状态
- v3 兼容读取：v4 能读取 v3 历史产物（通过 adapter 层）
- Workflow 瘦身：从 553 行降到 ~50 行

**Non-Goals（明确排除，留给 v4.1+）：**
- Event Cluster / Entity Extract / Event Rank 聚类引擎
- SQLite / S3 存储后端
- DAG 调度 / 并行 Phase
- Event Bus / 异步通知
- Learning Engine / 自动化反馈闭环
- 增量生成 / Phase 级缓存 / Replay / Snapshot
- Prompt Engine 升级（PromptBuilder）
- 多平台 Renderer（公众号 HTML / B站字幕 / Newsletter）

> **注：** §2 PhaseResult 中的 `hash / cacheHit / replayed` 字段是为 v4.1+ 预留的结构占位，v4.0 不实现这些能力，Phase 返回时可省略或填 null。

## 设计原则

> **Phase 永远不关心数据存在哪里，也不关心数据从哪里来；Phase 只负责驱动一个 Use Case，而所有业务规则由 Domain 完成，所有数据访问由 Repository 完成。**

---

## §1 Runtime 边界与 PipelineRunner

### Workflow 只做三件事

1. 构建 `PipelineContext`
2. 调用 `pipeline.run(ctx)`
3. 输出结果

```js
// ai-ribao-daily.js (v4, ~50 行)
import { createPipelineContext } from './scripts/engine/context.mjs'
import { createPipeline } from './scripts/engine/pipeline.mjs'

export const meta = {
  name: 'ai-ribao-daily',
  description: 'AI 日报 - Pipeline v4（Content Intelligence Runtime）',
  phases: [{ title: '执行', detail: 'Pipeline 自动调度所有 Phase' }],
}

const ctx = createPipelineContext({
  date: (args && args.date) || new Date().toISOString().slice(0, 10),
  workflowRuntime: { phase, agent, log },
})

const pipeline = createPipeline()
const result = await pipeline.run(ctx)
return result
```

**workflow 不知道今天有几个 Phase、Phase 的顺序、哪些是 LLM 哪些不是。** 增减 Phase 不改 workflow。

### PipelineRunner（~80 行）

```js
// scripts/engine/pipeline.mjs
export function createPipeline() {
  const phases = [
    new CollectPhase(),
    new VerifyPhase(),
    new ScorePhase(),
    new DedupPhase(),
    new CuratePhase(),
    new GenerateArticlePhase(),
    new GenerateScriptPhase(),
    new RenderPhase(),
    new ValidatePhase(),
    new ArchivePhase(),
  ]

  return {
    async run(ctx) {
      const results = []
      const startedAt = Date.now()

      for (const phase of phases) {
        if (await phase.shouldSkip?.(ctx)) continue

        ctx.runtime.workflow.phase(phase.name)
        ctx.services.logger.info(`▶ ${phase.name}`)
        await phase.before?.(ctx)

        let result
        try {
          result = await phase.run(ctx)
        } catch (err) {
          result = PhaseResult.fatal(err.message)
        }
        result.duration = ctx.environment.clock.elapsed(startedAt)

        await phase.after?.(ctx, result)
        results.push({ phase: phase.name, ...result })

        if (result.status === 'fatal') {
          ctx.services.logger.error(`Fatal: ${result.reason}`)
          // 即使中途 fatal，也把当前 manifest 落盘
          const partialManifest = assembleRunView(results, startedAt)
          ctx.stores.execution.savePartial(partialManifest)
          return { status: 'fatal', phase: phase.name, reason: result.reason, manifest: partialManifest }
        }
      }

      return { status: 'success', manifest: assembleRunView(results, startedAt) }
    },
  }
}
```

**PipelineRunner 的额外职责：**
- 统一捕获异常并转换为标准 PhaseResult
- 统一补齐 duration 字段
- Fatal 时也落盘截至当前的 manifest（不丢观测数据）

### 运行时原语注入

Claude Code 的 `phase()`、`agent()`、`log()` 是全局函数，只在 workflow script 顶层作用域可用。通过 `ctx.runtime` 注入 Phase 层，并按语义分层：

```
ctx.runtime.workflow.phase(name)    // Claude Code phase 标记
ctx.runtime.llm.agent(prompt, opts) // Claude Code agent 调用
ctx.runtime.log(message)            // Claude Code log 原语
```

Phase 一般不直接碰 `ctx.runtime`，只在标记 phase 边界等特殊场景才用。

---

## §2 PipelineContext 与 Phase 接口

### PipelineContext — 五个 Root，不是平铺

```js
ctx
├── runtime          // Claude Code 原语注入（Phase 一般不直接用）
│   ├── workflow.phase(name)
│   ├── llm.agent(prompt, opts)
│   └── log(message)
│
├── environment      // 运行环境（只读）
│   ├── date
│   ├── config       // versions, sources, thresholds
│   ├── workspace    // base output path
│   └── clock
│
├── services         // 横切关注点
│   ├── agent        // ctx.services.agent.generate(prompt, schema, opts)
│   ├── prompt       // ctx.services.prompt.load(path, vars)
│   ├── logger       // ctx.services.logger.info/warn/error
│   ├── metrics      // ctx.services.metrics.record(phase, key, value)
│   └── cache        // ctx.services.cache.get/set/has (v4.0 预留)
│
├── stores           // 数据仓库（Domain 用，Phase 不直接用）
│   ├── assets       // ctx.stores.assets.save() / load() / append()
│   ├── events       // ctx.stores.events.save() / load() / history(days)
│   ├── artifacts    // ctx.stores.artifacts.save(type, data) / load(type)
│   └── execution    // ctx.stores.execution (PipelineRun / PhaseExecution)
│
└── domain           // 业务规则入口（Phase 直接调用）
    ├── ranking
    ├── dedup
    ├── curation
    ├── generate
    ├── render
    └── validate
```

> **注：** `collect` 和 `verify` 不作为独立 domain 暴露。它们是 application-phase 直接编排的薄用例（调用 `ctx.services.agent` 执行外部脚本），Phase 内部处理即可，不需要 domain 层介入。

**关键约束：**
- ctx 顶层只有 5 个属性（runtime/environment/services/stores/domain），永不膨胀
- Phase 只调 `ctx.domain.*`，不直接碰 stores
- Domain 方法内部访问 stores，业务规则和数据访问解耦
- 以后增加 Notifier/Publisher/Embedding/VectorStore 等，放到 `ctx.services.*`，不污染顶层

### Store 接口 — Repository 语义

```js
// 不是文件 API：
ctx.storage.read('raw/all-raw.json')   // ✗
ctx.storage.write('events', data)      // ✗

// 而是 Repository 语义：
ctx.stores.assets.save(items)           // ✓
ctx.stores.assets.load()                // ✓
ctx.stores.assets.append(newItems)      // ✓

ctx.stores.events.save(events)
ctx.stores.events.load()
ctx.stores.events.history(14)           // 最近 14 天

ctx.stores.artifacts.save('article', articleArtifact)
ctx.stores.artifacts.load('article')
ctx.stores.artifacts.loadMarkdown('article')
```

v4.0 实现是 JSON 文件，v4.1 换 SQLite 时只改 Store 内部。Phase 和 Domain 都不知道底层存储。

### Phase 接口 — 带生命周期

```js
interface Phase {
  name: string

  shouldSkip(ctx): boolean | Promise<boolean>   // 可选：条件跳过
  before(ctx): Promise<void>                     // 可选：前置准备
  run(ctx): Promise<PhaseResult>                 // 必须：核心逻辑
  after(ctx, result): Promise<void>              // 可选：后置清理
}
```

### PhaseResult — 参考 CI Pipeline 惯例

```js
PhaseResult {
  status:    'ok' | 'fatal' | 'warn' | 'skipped'
  inputs:    { ... }         // 本 Phase 消费的数据摘要
  outputs:   { ... }         // 本 Phase 产出的数据摘要
  metrics:   { ... }         // 量化指标
  artifacts: [ ... ]         // 产出的对象引用
  warnings:  [ string ]      // 非致命问题
  errors:    [ string ]      // 致命错误详情
  duration:  number          // ms，由 PipelineRunner 统一补

  // v4.0 预留字段（不要求实现）
  hash:      string | null
  cacheHit:  boolean | null
  replayed:  boolean | null
}
```

**Manifest 就是 PhaseResult[] 的聚合**，由 `assembleRunView(results, startedAt)` 统一构建，不散落在各 Phase 中。

### Execution 模型

```js
PipelineRun {
  id:              string        // 如 'run-20260623-abc123'
  date:            string
  pipelineVersion: string
  promptVersion:   string
  startedAt:       ISO timestamp
  finishedAt:      ISO timestamp
  status:          'success' | 'fatal' | 'partial'
  results:         PhaseResult[]
  manifest:        object         // assembleRunView 生成的聚合视图
}

PhaseExecution {
  phase:    string
  start:    ISO timestamp
  end:      ISO timestamp
  status:   string
  retry:    number
  result:   PhaseResult
}
```

存储在 `ctx.stores.execution`，v4.0 写入 `output/<date>/execution.json`。

### Phase 如何调用 Domain

```js
// Phase（Application 层）— 只做 Use Case 编排
export class GenerateArticlePhase {
  name = '文章生成'
  async run(ctx) {
    const { content, meta } = await ctx.domain.generate.article()
    await ctx.stores.artifacts.save('article', {
      type: 'article',
      content,
      rendered: null,
      meta,
    })
    return PhaseResult.ok({ outputs: { type: 'article' } })
  }
}

// Domain — 负责业务规则
export function createGenerateDomain(ctx) {
  return {
    async article() {
      const events = await ctx.stores.events.load()
      const prompt = ctx.services.prompt.load('prompts/v1/article.md', {
        input_data: JSON.stringify(events).slice(0, 15000),
        editorial_examples: ctx.services.prompt.loadExamples('good_editorials'),
      })
      const content = await ctx.services.agent.generate(prompt, ARTICLE_SCHEMA)
      return {
        content,
        meta: {
          eventIds: events.map(e => e.id),
          model: 'sonnet',
          promptVersion: ctx.environment.config.promptVersion,
          inputHash: sha256(events),
        },
      }
    },
  }
}
```

**依赖方向：Phase → Domain → Stores + Services。Phase 永远不直接碰 Stores。**

---

## §3 Event / Asset / Artifact Schema

### 设计目标

**"只改数量，不改接口"** — v4.0 建立 `1 Asset = 1 Event`，v4.1 聚类后 `N Asset = 1 Event`，下游接口零变化。

### Asset — 原始知识对象

Asset 只表示"原始可追踪输入"，评分/选题结果不回流。

```js
Asset {
  // ── 标识 ──
  id:             string
  type:           'rss' | 'web' | 'paper' | 'tweet' | 'release' | 'blog'

  // ── 内容 ──
  title:          string
  url:            string
  summary:        string
  content:        string | null      // 全文（v4.0 暂为空）

  // ── 来源 ──
  source: {
    name:         string
    tier:         1 | 2 | 3
    url:          string | null
  }

  // ── 时间 ──
  publishedAt:    ISO timestamp
  fetchedAt:      ISO timestamp
  verifiedAt:     ISO timestamp | null

  // ── 指纹（一等字段）──
  contentHash:    string             // 稳定指纹，用于 dedup / cache / replay

  // ── 分类 ──
  category:       string | null
  language:       'zh' | 'en' | 'mixed'

  // ── 采集元数据 ──
  metadata: {
    impactScore:        number
    urlVerified:        boolean
    deadLink:           boolean
    dateFromHtml:       boolean
  }
}
```

### Event — 经过理解的知识对象

Event 是 Pipeline 的核心数据模型。`rank` 和 `curation` 是 Domain 派生快照，`sources[]` / `assetIds[]` / `clusterId` 是稳定连接器。

```js
Event {
  // ── 标识 ──
  id:             string            // v4.0 = asset.id
  type:           'news' | 'announcement' | 'release' | 'research' | 'opinion'

  // ── 内容 ──
  title:          string
  summary:        string
  url:            string | null     // v4.0 = asset.url, v4.1 聚类后可能 null

  // ── 稳定连接器 ──
  sources:        [{ name, tier, url, publishedAt }]  // v4.0 始终 1 个, v4.1 可多个
  assetIds:       string[]          // v4.0 = [asset.id], v4.1 = [id1, id2, ...]
  clusterId:      string | null     // v4.0 = null, v4.1 = 'cluster-xxx'

  // ── 指纹 ──
  contentHash:    string

  // ── Ranking Domain 派生快照 ──
  rank: {
    baseScore:    number
    bonusScore:   number
    totalScore:   number
    tierLabel:    'auto' | 'review' | 'skip'
    factors:      { authority, timeliness, verifiability, contentQuality,
                    entityWeight, eventType, quantSignal, academicSignal }
  }

  // ── Curation Domain 派生快照 ──
  curation: {
    importance:   'deep' | 'important' | 'brief'
    note:         string | null
  } | null

  // ── 实体与主题（v4.0 留空，v4.1 填充）──
  entities:       string[]
  topics:         string[]
  relatedEventIds: string[]

  // ── 时间线 ──
  timeline: {
    collected:    ISO timestamp
    verified:     ISO timestamp | null
    curated:      ISO timestamp | null
    generated:    ISO timestamp | null
  }

  // ── 元数据 ──
  metadata:       object
}
```

**v4.0 → v4.1 的变化只在这些字段：**

| 字段 | v4.0 | v4.1 |
|------|------|------|
| `sources` | 始终 1 个元素 | 可多个 |
| `assetIds` | `[asset.id]` | `[id1, id2, ...]` |
| `url` | `= asset.url` | 可能 null |
| `entities` | `[]` | `['OpenAI', 'GPT-6']` |
| `topics` | `[]` | `['LLM', 'benchmark']` |
| `clusterId` | `null` | `'cluster-xxx'` |

### Artifact — 面向渠道的结构化输出

Artifact 分为三层：`content`（LLM 生成的结构化内容）、`rendered`（投放形态）、`meta`（元数据）。

```js
ArticleArtifact {
  type: 'article'

  // ── content 层（LLM 生成）──
  content: {
    hook:           string
    summaryItems:   [{ title, oneLiner }]
    deepItems:      [{ title, whatHappened, details, whyMatters, implications, sources }] | null
    importantItems: [{ title, keyPoint, analysis, source }] | null
    briefItems:     [{ title, fact }] | null
    editorial:      { observation, evidence, judgment, prediction }
  }

  // ── rendered 层（Render Domain 写入）──
  rendered: {
    markdown:       string | null
    html:           string | null    // v4.1+: 公众号
  } | null

  // ── meta 层（Generate Domain 写入）──
  meta: {
    generatedAt:    ISO timestamp
    model:          string
    promptVersion:  string
    eventIds:       string[]
    inputHash:      string
    retryCount:     number
  }
}

ScriptArtifact {
  type: 'script'

  content: {
    hook:           { text, durationS }
    overview:       { text, durationS }
    closing:        { text, durationS }
    deepItems:      [{ ... }] | null
    quickItems:     [{ ... }] | null
  }

  rendered: {
    markdown:       string | null
    subtitles:      string | null    // v4.1+: B站字幕
  } | null

  meta: {
    generatedAt:    ISO timestamp
    model:          string
    promptVersion:  string
    eventIds:       string[]
    inputHash:      string
    totalDurationS: number
  }
}
```

### v3 兼容 Adapter

作为独立模块，不埋在 Store 里。Store 负责存取，Adapter 负责格式演化。

### contentHash 计算责任

| 对象 | 计算时机 | 计算内容 |
|------|---------|---------|
| Asset | 采集/归一化阶段（CollectDomain 写入前） | `sha256(title + url + summary + publishedAt)` |
| Event | 由关联 Asset 派生（ScorePhase buildEvents 时） | v4.0 直接继承 Asset 的 contentHash；v4.1 聚类后为多 Asset hash 的稳定组合 |
| Artifact.inputHash | GenerateDomain 内部（调用 LLM 前） | `sha256(序列化的 Event[] 输入)` |

contentHash 是一等字段，不放在 metadata 里。dedup、cache、replay 的边界由此字段界定。

```js
// scripts/engine/adapters/v3-compat.mjs

// 读兼容：v3 curated.json → Event[]
export function adaptV3CuratedToEvents(v3Curated) { ... }

// 读兼容：v3 article.json → ArticleArtifact
export function adaptV3ArticleToArtifact(v3Article) { ... }
```

Store 内部通过 adapter 层调用：

```js
// EventStore.history() 内部
async history(days) {
  for (const date of recentDates) {
    const raw = await this._loadRaw(date)
    if (isV3Format(raw)) {
      events.push(...adaptV3CuratedToEvents(raw))  // adapter 转换
    } else {
      events.push(...raw)
    }
  }
  return events
}
```

**只做读兼容，不做写兼容。** v4 正常写入只写 v4 格式，不额外生成 `curated-v3.json`。14 天后所有历史都是 v4 格式，adapter 可移除。

---

## §4 Domain Layer 拆分

### 目录结构

```
scripts/domain/
├── ranking.mjs      // 合并 score.mjs + collect-rss.mjs 的 computeImpactScore
├── dedup.mjs        // 从 dedup.mjs 迁移，去掉 outputDir 参数
├── curation.mjs     // 从 workflow Phase 4 代码提取
├── generate.mjs     // 从 workflow Phase 5 代码提取（含 parseJsonFallback、重试）
├── render.mjs       // 合并 render-article.mjs + render-script.mjs
└── validate.mjs     // 从 validate-output.mjs 迁移
```

`collect` 和 `verify` 不需要独立 domain —— 它们是薄包装层，Phase 直接调 `ctx.services.agent` 执行外部脚本。

### 各 Domain 职责

#### `ranking` — 评分与分级

```js
export function createRankingDomain(ctx) {
  return {
    scoreAsset(asset, allAssets) { ... },
    scoreAll(assets) { ... },
    classify(scoredAssets) { ... },   // auto / review / skip
    buildEvents(scoredAssets) { ... }, // 输出 Event-ready 结果（含 rank 快照）
  }
}
```

合并 v3 的 `score.mjs` + `collect-rss.mjs` 的 `computeImpactScore`，消除代码重复。评分逻辑只有一个权威来源。

#### `dedup` — 去重规则

```js
export function createDedupDomain(ctx) {
  return {
    async run(events) {
      const history = await ctx.stores.events.history(14)
      // 三级去重：URL 精确匹配 / 事件指纹 / 标题 bigram 相似度
      return { kept: [...], removed: [...] }
    },
  }
}
```

#### `curation` — LLM 选题编排

```js
export function createCurationDomain(ctx) {
  return {
    async select(candidates) {
      const prompt = ctx.services.prompt.load('prompts/v1/curation.md', { ... })
      const result = await ctx.services.agent.generate(prompt, CURATION_SCHEMA)
      return { curatedEvents: [...], summary: { ... } }
    },
  }
}
```

#### `generate` — LLM 内容生成编排

```js
export function createGenerateDomain(ctx) {
  return {
    async article() {
      // 读 events → 构建 prompt → agent.generate() → JSON 解析兜底 + 重试
      // 返回 { content: ArticleContent, meta: { eventIds, model, promptVersion, retryCount, inputHash } }
    },
    async script(articleContent) {
      // 返回 { content: ScriptContent, meta: { ... } }
    },
  }
}
```

#### `render` — 渲染规则

```js
export function createRenderDomain(ctx) {
  return {
    article(articleContent, context) { ... },  // → markdown 字符串
    script(scriptContent) { ... },              // → markdown 字符串
  }
}
```

#### `validate` — 校验规则

```js
export function createValidateDomain(ctx) {
  return {
    run(articleArtifact, scriptArtifact, curatedEvents) {
      // 继承 v3 的 8 项内容质量检查 + article-script 一致性
    },
  }
}
```

### Domain 依赖关系

```
ranking     ← 无外部依赖（纯规则）
dedup       ← stores.events.history（数据读取）
curation    ← stores.events + services.prompt + services.agent（LLM）
generate    ← stores.events + services.prompt + services.agent（LLM）
render      ← 纯规则
validate    ← 纯规则
```

**Domain 之间不互相调用。** 跨 domain 编排由 Phase 层负责。

### Phase → Domain → Store 调用关系

| Phase | 调用 Domain | 读 Store | 写 Store |
|-------|-----------|---------|---------|
| CollectPhase | services.agent（直接编排） | — | assets.save() |
| VerifyPhase | services.agent（直接编排） | assets.load() | assets.save(valid) |
| ScorePhase | domain.ranking | assets.load() | events.save() |
| DedupPhase | domain.dedup | events.load() + history | events.save(deduped) |
| CuratePhase | domain.curation | events.load() | events.save(curated) |
| GenerateArticlePhase | domain.generate.article | events.load() | artifacts.save('article') |
| GenerateScriptPhase | domain.generate.script | events + artifacts.load('article') | artifacts.save('script') |
| RenderPhase | domain.render | artifacts.load() | artifacts.save(rendered) |
| ValidatePhase | domain.validate | artifacts + events.load() | — |
| ArchivePhase | — (infrastructure glue) | artifacts + events + execution | 写磁盘 |

**ArchivePhase 是 infrastructure / application glue，不属于核心 domain。** 它只做：读取 execution / artifacts / events，写磁盘文件、写索引、写 manifest 视图。

---

## §5 迁移路径（v3 → v4）

### 核心约束

1. v3 在迁移期间必须保持可运行
2. v4 必须能读 v3 历史产物（dedup 需要 14 天历史）
3. 切换前必须有对比验证
4. 切换是一步操作，可回滚

### 目录结构映射

```
v3                              v4（新增，v3 文件不删不改）
──────────────────────          ──────────────────────────────
ai-ribao-daily.js              ai-ribao-daily.js（重写 ~50 行）
scripts/                        scripts/
  config.mjs                    engine/
  collect-rss.mjs                 context.mjs
  verify-urls.mjs                 pipeline.mjs
  score.mjs                       phase-result.mjs
  dedup.mjs                       execution.mjs
  render-article.mjs              adapters/
  render-script.mjs                 v3-compat.mjs
  validate-output.mjs             v4-compat.mjs
  feedback.mjs                  phases/
  test-modules.mjs                collect.mjs / verify.mjs / score.mjs / ...
                                domain/
                                  ranking.mjs / dedup.mjs / curation.mjs / ...
                                stores/
                                  assets.mjs / events.mjs / artifacts.mjs / execution.mjs
                                config.mjs
                                test-modules.mjs（扩展）
```

### 迁移顺序（7 个 Wave）

```
Wave 0: 基础设施 — engine/ + stores/ + adapters/（无业务逻辑）
Wave 1: 数据模型 — Asset/Event/Artifact schema + v3-compat adapter
Wave 2: 纯规则 Domain — ranking + dedup + render + validate
Wave 3: LLM Domain — curation + generate
Wave 4: Phase 模块 — scripts/phases/ 全部 10 个 Phase
Wave 5: PipelineRunner + 新 Workflow — v4 可独立运行
Wave 6: 对比验证 + 切换 — 双跑 3-5 天，验证通过后一步切换
```

每个 Wave 结束后 v3 仍然能跑。v3 文件在 v4 稳定运行一周后再清理。

### 对比验证策略（Wave 6，3-5 天）

每天同时运行 v3 和 v4：

```
v3: /ai-ribao-daily-v3        ← 旧 workflow（重命名保留）
v4: /ai-ribao-daily            ← 新 workflow

对比指标：
├── candidates 数量差异（应 < 5%）
├── curated 条目重叠率（应 > 90%）
├── article.md 字数差异（应 < 20%）
├── script.md 时长差异（应 < 15%）
├── validation 通过率一致
├── schema validation pass rate / artifact shape consistency（应 100%）
└── manifest 各 Phase duration 差异（应 < 30%）
```

### 切换操作

**切换前，v3 入口保持原名（`ai-ribao-daily.js`）；切换确认后，才进行 rename。** 双跑期间 v4 以 `ai-ribao-daily-v4.js` 运行。

```bash
# 双跑期间（v3 保持原名，v4 为临时名）
# v3: /ai-ribao-daily          ← 旧 workflow，原名不变
# v4: /ai-ribao-daily-v4       ← 新 workflow，临时名

# 确认 v4 稳定后，正式切换
mv .claude/workflows/ai-ribao-daily.js    .claude/workflows/ai-ribao-daily-v3.js
mv .claude/workflows/ai-ribao-daily-v4.js .claude/workflows/ai-ribao-daily.js

# 验证
/ai-ribao-daily --date 2026-06-24

# 一周后清理 v3 入口（可选）
```

**回滚：** 把 v3 文件名换回来即可。v3 的 `scripts/` 下原始模块从未被修改。

### v3 历史产物兼容

**读历史（dedup、质量趋势）：** `EventStore.history(14)` → 检测 v3 格式（有 `selected_items`）→ 调 `v3-compat` adapter 转换为 Event[]。

**只读兼容，不写兼容。** v4 正常写入只写 v4 格式。

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| v4 LLM 产出质量变化 | 中 | Wave 6 对比验证逐日检查；Prompt 未变，理论上一致 |
| v3 历史产物格式不一致 | 低 | v3-compat adapter 做防御性解析，异常时 fallback 空数组 |
| PipelineRunner 异常处理覆盖不全 | 低 | PhaseResult.fatal 已覆盖；v3 本身无异常处理框架 |
| Claude Code Workflow 运行时兼容性 | 低 | 新 workflow 仍用 phase()/agent()/log() 原语 |
| 迁移期间改 config 影响两边 | 中 | 迁移期间不改 config；需改时两边同时验证 |
| Context 设计过度（God Object 风险） | 中 | 限制 ctx 顶层 5 个属性；新增能力放 services/stores 子层 |
| Domain 层初次实现可能过于粗粒度 | 低 | v4.0 先按当前模块粒度迁移；v4.1 再细分 |
