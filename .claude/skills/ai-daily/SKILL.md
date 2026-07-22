---
name: ai-daily
description: AI 领域日报自媒体自动化。用户说"生成今日日报"或"/daily"时触发。Dual Runtime：Ingestion（纯代码，持续采集写入 SQLite）+ Editorial（Agent 驱动，读取 SQLite 产出日报）。兼容所有主流 Agent。
---

# AI 日报

从 15+ 信源采集 AI 新闻，经评分、去重、选题后，生成日报文章和播客脚本。

## 触发条件

- "生成今日日报" / "/daily" → 执行 Editorial 流程
- "采集今日 AI 新闻" → 执行 Ingestion 流程
- "生成周报" / "/weekly" → 执行 Weekly Pipeline
- "查看日报历史" → 查询 SQLite

## 架构

```
Ingestion（纯代码，cron / 手动）
  node scripts/run-ingestion.mjs
  collect → normalize → verify → extract → cluster → score → dedup → store
  输出 → SQLite (data/events.db)

Editorial（Agent 驱动，/daily）
  Agent 读取 SQLite → 选题 → 写文章 → 写播客脚本 → 调代码渲染/校验/归档
  输出 → output/production/ai/<date>/
```

**Ingestion 是纯 Node.js，不需要 LLM。Editorial 是 Skill，Agent 自己就是 LLM。**

## Ingestion 运行

```bash
# 手动运行
node scripts/run-ingestion.mjs

# 定时运行（cron）
# */5 * * * * cd /path/to/ai-ribao && node scripts/run-ingestion.mjs
```

详见 `references/INGESTION.md`。

---

## Editorial 流程（Agent 执行）

以下是 Agent 执行日报的完整流程。每一步都有明确的输入/输出和检查点。

### Step 1: 从 SQLite 读取今日事件

```bash
node --input-type=module -e "
import { createSqliteDatabase } from './scripts/infrastructure/database.mjs'
import { createSqliteEventReadModel } from './scripts/read-models/sqlite/event-read-model.mjs'
const db = createSqliteDatabase()
const rm = createSqliteEventReadModel(db)
const today = new Date().toISOString().slice(0, 10)
const from = today + 'T00:00:00Z'
const to = new Date(Date.now() + 86400000).toISOString().slice(0, 10) + 'T00:00:00Z'
const events = rm.findByWindow(from, to)
console.log(JSON.stringify({ count: events.length, events: events.slice(0, 50) }, null, 2))
db.close()
"
```

**检查点：**
- [ ] 产出符合 Output Quality Constitution 8 条不变量
- [ ] 来源分布满足 36氪+虎嗅合计不超过 70% 如果 count = 0，先运行 Ingestion（`node scripts/run-ingestion.mjs`）。

### Step 2: 选题（Agent 执行）

从 Step 1 的事件中，选出 15-20 条最重要的新闻。

**选题规则：**
- 优先选择有具体数据、官方来源、影响范围大的新闻
- 同一事件只保留最重要的一条
- 为每条分配 importance: `deep`（重磅深度）/ `important`（重要动态）/ `brief`（快讯）
- 至少 1 条 deep，至少 3 个不同来源
- **URL 规则：** 每条 selected item 的 `url`、`source_name`、`summary` 字段必须原样复制自 Step 1 查询结果，禁止编造或修改。如果某条事件没有 `url`，设为 `null`，不得自行构造

**检查点：**
- [ ] selected 在 15-20 之间
- [ ] 至少 1 条 deep
- [ ] 来源多样性 >= 3
- [ ] 每条 selected item 的 url 与 Step 1 查询结果中的 url 完全一致

将选题结果写入 `output/production/ai/<date>/curated.json`。

### Step 2.5: 采集证据（调用代码）

对已选题的每条事件（curated.json），执行 URL 截图作为证据资产。

```bash
node --input-type=module -e "
import { readFileSync } from 'node:fs'
import { collectBatchEvidence } from './scripts/evidence/collector.mjs'
const date = new Date().toISOString().slice(0, 10)
const curated = JSON.parse(readFileSync('output/production/ai/' + date + '/curated.json', 'utf-8'))
const events = curated.selected_items.map(i => ({ id: i.id, title: i.title, url: i.url, source: i.source, entities: [] }))
const results = await collectBatchEvidence(events, { outputBase: 'output/production/ai', onProgress: console.log })
console.log(JSON.stringify({ collected: results.filter(Boolean).length, total: events.length }))
"
```

**检查点：**
- [ ] evidence/ 目录出现在 `output/production/ai/<date>/evidence/<event-id>/` 下
- [ ] 每个证据目录包含 screenshot.png + evidence.json

### Step 3: 生成文章（Agent 执行）

按 `references/EDITORIAL.md` 的文章结构，为选中的新闻生成日报文章。

**要求：**
- 输出 JSON 结构：hook / summary_items / deep_items / important_items / brief_items / editorial
- 每条 deep item 必须有具体数字
- editorial 三段结构：观察 / 证据 / 判断（每段 >= 30 字）
- 不编造数据，不编造 URL
- **URL 规则**：每条 summary_item、deep_item、important_item、brief_item 都必须从 `curated.json` 中复制对应的 `url` 和 `source_name`，写入 `source`/`sources` 字段。禁止跳过或遗漏。如果某条事件没有 url，设为 `null`

**检查点：**
- [ ] 每条 summary_item 含 `source: { name, url }`
- [ ] 每条 deep_item 含 `sources: [{ name, url }]`
- [ ] 每条 important_item 含 `source: { name, url }`
- [ ] 每条 brief_item 含 `sources: [{ name, url }]`
- [ ] 所有 URL 与 `curated.json` 完全一致

将文章 JSON 写入 `output/production/ai/<date>/article.json`。

### Step 4: 生成播客脚本（询问用户）

文章生成后，先询问用户是否需要播客脚本：

> 文章已生成。是否生成播客脚本？
>   ✓ 生成 → 按 `prompts/v1/script.md` 生成双人对话脚本
>   ✗ 跳过 → 直接进 Step 5 渲染

**如果用户选择"生成"：**

按 `prompts/v1/script.md` 的播客脚本结构，基于文章内容生成双人对话脚本。

**要求：**
- 输出 JSON 结构：hook / overview / deep_items / quick_items / closing，每段为对话数组
- 每段对话包含 speaker（"M" 男主播 / "F" 女主播）和 text
- 总时长 180-300 秒
- 口语化、短句为主、TTS 友好（无括号注释、无表情符号、无舞台指示）

将播客脚本 JSON 写入 `output/production/ai/<date>/script.json`。

**检查点：**
- [ ] 脚本总时长 180-300s
- [ ] 每段均为对话数组格式（非单人文本）

**如果用户选择"跳过"：** 直接进 Step 5，渲染时跳过 script 相关输出。

### Step 5: 渲染（调用代码）

```bash
node scripts/render-article.mjs <date>
# 例: node scripts/render-article.mjs 2026-07-11
```

**检查点：**
- [ ] article_chars > 2000

### Step 6: 校验（调用代码）

```bash
node --input-type=module -e "
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createValidationPolicy } from './scripts/policies/validation-policy.mjs'
const date = process.argv[1] || new Date().toISOString().slice(0, 10)
const od = join('.', 'output/production/ai', date)
const curated = JSON.parse(readFileSync(join(od, 'curated.json'), 'utf-8'))
const am = readFileSync(join(od, 'article.md'), 'utf-8')
const sm = readFileSync(join(od, 'script.md'), 'utf-8')
const dom = createValidationPolicy()
const r = dom.execute({ article: {}, script: {}, curatedEvents: curated.selected_items || [], articleMarkdown: am, scriptMarkdown: sm })
console.log(JSON.stringify(r))
"
```

**检查点：**
- [ ] validation_passed = true

### Step 6b: Agent 语义评审（Agent 执行）

以评审者身份通读 `article.md`、`article.json`、`curated.json`，从以下维度给出评分。每个维度输出 score（1-5）和 evidence（引用原文）。

**评审维度：**
1. 头条准确度 — 头条是否抓住了当天最重要的 AI 新闻。对比当日 curated 中其他候选事件评判
2. 深度质量 — deep_items 是否有分析（因果/对比/趋势）而非仅仅摘要。引用 Constitution Invariant 6
3. 编辑判断 — editorial.judgment 是否有独立观点而非复述新闻。引用 Constitution Invariant 2
4. 叙事连贯性 — hook、速览、深度、编辑观点之间是否有清晰主线
5. 来源集中度预警 — 当天的来源是否过度集中于少数信源（标记但不否决）

**评分标准：**
- 5 分：显著超出预期
- 4 分：符合预期且有亮点
- 3 分：达到最低标准
- 2 分：低于预期，有改进空间
- 1 分：明显不足

**评审结果写入 `output/production/ai/<date>/review.json`：**

```json
{
  "date": "<date>",
  "generated_at": "<ISO 时间戳>",
  "dimensions": [
    { "name": "头条准确度", "score": 4, "evidence": "..." },
    { "name": "深度质量", "score": 3, "evidence": "..." },
    { "name": "编辑判断", "score": 4, "evidence": "..." },
    { "name": "叙事连贯性", "score": 3, "evidence": "..." },
    { "name": "来源集中度预警", "score": 4, "evidence": "..." }
  ],
  "highlights": ["头条选得好", "editorial 有洞察"],
  "improvements": ["deep_item 分析不足", "叙事结构略散"],
  "reviewedBy": "agent",
  "reviewedAt": "<ISO 时间戳>"
}
```

**检查点：**
- [ ] review.json 存在且格式完整
- [ ] 每个维度有 score 和 evidence
- [ ] improvements 至少有 1 条
- [ ] 评分遵循 temperature=0 原则，确保可复现性

### Step 7: 音频合成（询问用户）

校验通过后，询问用户是否合成播客音频：

> 日报已生成，校验通过。要不要合成播客音频？
>   ✓ 合成 → 选择 TTS Provider
>   ✗ 跳过 → 直接归档

**如果用户选择"合成"，再询问 TTS Provider：**

> 选择 TTS Provider：
>   1. edge-tts（免费，默认）
>   2. OpenAI TTS（需 OPENAI_API_KEY）
>   3. MiniMax TTS（需 MINIMAX_API_KEY）

**如果用户选择"跳过"：** 直接进 Step 8。

**根据用户选择执行：**

```bash
# edge-tts（免费）
bash scripts/tts/synthesize.sh output/production/ai/{{date}}/script.json

# OpenAI TTS
TTS_PROVIDER=openai OPENAI_API_KEY=sk-... bash scripts/tts/synthesize.sh output/production/ai/{{date}}/script.json

# MiniMax TTS
TTS_PROVIDER=minimax MINIMAX_API_KEY=... bash scripts/tts/synthesize.sh output/production/ai/{{date}}/script.json
```

**检查点：**
- [ ] audio/podcast.mp3 存在（如果选择了合成）

### Step 8: 归档（调用代码）

```bash
node --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const date = process.argv[1] || new Date().toISOString().slice(0, 10)
const od = join('.', 'output/production/ai', date)
writeFileSync(join(od, 'execution.json'), JSON.stringify({ id: 'edit-' + date, date, pipelineVersion: 'v4.2', status: 'success' }, null, 2))
const ip = join('.', 'output/production/ai', 'index.json')
let idx = { version: 1, entries: [] }
try { idx = JSON.parse(readFileSync(ip, 'utf-8')) } catch {}
const cur = JSON.parse(readFileSync(join(od, 'curated.json'), 'utf-8'))
idx.entries = idx.entries.filter(e => e.date !== date)
idx.entries.unshift({ date, items: (cur.selected_items || []).map(i => ({ id: i.id, title: i.title, url: i.url, source: i.source?.name || i.source_name, importance: i.curation?.importance || i.importance })), selected_count: cur.selected_items?.length || 0, pipeline_version: 'v4.2' })
idx.entries = idx.entries.slice(0, 30)
writeFileSync(ip, JSON.stringify(idx, null, 2))
console.log('Archive complete')
"
```

---

## Weekly Pipeline（周报生成）

v4.4 新增。读取最近 7 天 Event，按 Cluster 聚合，生成周报。

### 运行

```bash
# 纯代码运行（无 LLM 时使用默认模板）
node scripts/run-weekly.mjs

# 指定日期
node scripts/run-weekly.mjs --week 2026-06-26
```

### 流程

```
LoadWeekEvents → AggregateByCluster → GenerateWeeklyArticle → RenderWeekly → ArchiveWeekly
```

1. **LoadWeekEvents**: 读取最近 7 天 Event（SQLite）
2. **AggregateByCluster**: 按 cluster_id 聚合，无聚类的按天分组
3. **GenerateWeeklyArticle**: LLM 生成周报文章（无 LLM 时跳过，使用默认模板）
4. **RenderWeekly**: 渲染 article.md + script.md
5. **ArchiveWeekly**: 写入 `output/weekly/<start>_<end>/`

### 输出

```
output/weekly/2026-06-20_2026-06-26/
  article.md     # 周报文章
  script.md      # 播客脚本骨架
  manifest.json  # 元数据
```

---

## 自检协议

每个 Step 完成后，执行检查。**铁律：检查失败必须先修复，再汇报给用户。**

| Step | 检查项 | 方式 |
|------|--------|------|
| 1. 读取事件 | count > 0 | 读 SQLite |
| 2. 选题 | selected 15-20, >= 1 deep, >= 3 sources, 含 category 标签 | 检查 curated.json |
| 3. 文章 | content 非空, hook 存在, editorial 三段各 >= 30 字, summary_items 3~6 条且无 source 字段, deep_items 有 sources 数组, important_items 有 source 对象 | 检查 article.json |
| 4. 播客脚本 | 总时长 180-300s, 对话数组格式 | 检查 script.json |
| 5. 渲染 | article_chars > 2000, 用 `node scripts/render-article.mjs <date>` 渲染标准化格式 | 检查输出 |
| 6. 校验 | validation_passed = true | 检查输出 |
| 6b. 语义评审 | review.json 存在, 格式完整, improvements >= 1 | 检查 review.json |
| 7. 音频合成 | podcast.mp3 存在（如果选择了合成） | 检查 audio/ |
| 8. 归档 | execution.json 写入成功 | 检查输出 |

## 参考文档

| 文档 | 用途 | 何时读 |
|------|------|--------|
| `references/EDITORIAL.md` | 内容标准和写作风格 | Step 3-4 前 |
| `references/QUALITY.md` | 质量标准和反模式 | Step 6 校验时 |
| `references/INGESTION.md` | Ingestion 运维文档 | 运行 Ingestion 时 |
| `scripts/config.mjs` | 信源/评分/权重配置 | 调整配置时 |
| `docs/guides/article-format.md` | 文章格式规范 | 生成 article.json 时 |
| `docs/architecture/output-constitution.md` | 产出质量宪法（8 条不变量） | 每次生成日报后对照检查 |
| `scripts/domain/editorial/provenance-renderer.mjs` | 分层来源链渲染 | 渲染数据来源脚注时 |
| `docs/architecture/output-constitution.md` | 产出质量宪法（8 条不变量） | 每次生成日报后对照检查 |

## 信源管理

编辑 `scripts/config.mjs` 的 `RSS_SOURCES`。新增信源无需修改其他文件。

## 扩展指南

### 新增信源
编辑 `scripts/config.mjs` 的 `RSS_SOURCES`。

### 调整评分
编辑 `scripts/config.mjs` 的 `SCORING` / `ENTITY_WEIGHTS`。

### 新增 Pipeline
创建 `scripts/pipelines/weekly.mjs`。
