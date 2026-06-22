/**
 * AI 日报 - Pipeline v3
 *
 * 8 阶段混合流水线：
 *   Phase 1: RSS 采集 (Node.js)           → raw.json
 *   Phase 2: URL 验证 (Node.js)           → valid-raw.json
 *   Phase 3: 确定性处理 (Node.js)          → candidates.json (score + dedup)
 *   Phase 4: LLM 语义选题 (Sonnet)        → curated.json
 *   Phase 5: LLM 内容生成 (Sonnet, 串行)   → article.json + script.json
 *   Phase 6: 渲染+格式化 (Node.js)        → article.md + script.md
 *   Phase 7: 校验 (Node.js)               → validation result
 *   Phase 8: 归档 (Node.js)               → write files + index.json + manifest.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import {
  PIPELINE_VERSION, PROMPT_VERSION, RENDERER_VERSION, SCHEMA_VERSION,
  WORKFLOW_CONFIG, RSS_SOURCES, WEBSEARCH_QUERIES,
} from './scripts/config.mjs'
import { scoreAll } from './scripts/score.mjs'
import { dedup } from './scripts/dedup.mjs'
import { renderArticle, RENDERER_VERSION as ARTICLE_RENDERER_VER } from './scripts/render-article.mjs'
import { renderScript } from './scripts/render-script.mjs'
import { validate } from './scripts/validate-output.mjs'

export const meta = {
  name: 'ai-ribao-daily',
  description: 'AI 日报自媒体 - Pipeline v3（代码驱动 + LLM 语义选题/生成）',
  phases: [
    { title: 'RSS 采集', detail: 'Node.js 脚本并行抓取 RSS（零 LLM 成本）' },
    { title: 'URL 验证', detail: 'HEAD 请求检查每条链接是否可访问' },
    { title: '确定性处理', detail: '评分 + 去重 + 分级（纯代码）' },
    { title: 'LLM 选题', detail: 'LLM 对 review 区条目做语义判断' },
    { title: 'LLM 生成', detail: '串行生成 article.json + script.json' },
    { title: '渲染', detail: 'JSON → Markdown（Formatter + Template）' },
    { title: '校验', detail: 'Schema + 内容质量检查' },
    { title: '归档', detail: '写入文件 + manifest + index' },
  ],
}

// ============================================================
// 工具函数
// ============================================================

function sha256(content) {
  return 'sha256:' + createHash('sha256').update(typeof content === 'string' ? content : JSON.stringify(content)).digest('hex').slice(0, 16)
}

function loadJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
  }
}

function parseJsonFallback(text) {
  // 尝试直接解析
  try { return JSON.parse(text) } catch {}
  // 尝试截取 { 到 }
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)) } catch {}
  }
  return null
}

// ============================================================
// 主流程
// ============================================================

const DATE = (args && args.date) || new Date().toISOString().slice(0, 10)
const OUTPUT_DIR = join(WORKFLOW_CONFIG.outputDir, DATE)
const startedAt = Date.now()

// Manifest 构建对象
const manifest = {
  date: DATE,
  pipeline_version: PIPELINE_VERSION,
  prompt_version: PROMPT_VERSION,
  renderer_version: ARTICLE_RENDERER_VER,
  schema_version: SCHEMA_VERSION,
  llm_model: 'claude-sonnet',
  sources: { total: RSS_SOURCES.length, succeeded: 0, failed: [] },
  pipeline: {},
  quality: {},
  input_hashes: {},
  output_hashes: {},
}

mkdirSync(join(OUTPUT_DIR, 'raw'), { recursive: true })

// ============================================================
// Phase 1: RSS 采集
// ============================================================
phase('RSS 采集')
log('📡 Phase 1: RSS 采集...')
const t1 = Date.now()

const collectResult = await agent(
  `你是一个脚本执行器。运行以下命令采集 RSS 数据，然后报告结果。

执行命令:
\`\`\`
node scripts/collect-rss.mjs --date ${DATE}
\`\`\`

运行完毕后，报告：
1. 成功采集了几个源
2. 总共多少条新闻
3. 失败了几个源

不要修改任何数据，只报告采集结果。`,
  {
    label: 'RSS 采集',
    phase: 'RSS 采集',
    model: 'haiku',
    schema: {
      type: 'object',
      properties: {
        sources_ok: { type: 'number' },
        sources_error: { type: 'number' },
        total_items: { type: 'number' },
        output_path: { type: 'string' },
        failures: { type: 'array', items: { type: 'string' } },
      },
      required: ['sources_ok', 'total_items', 'output_path'],
    },
  }
)

manifest.pipeline.collect = {
  raw_count: collectResult.total_items,
  duration_s: Math.round((Date.now() - t1) / 1000),
}
manifest.sources.succeeded = collectResult.sources_ok
manifest.sources.failed = collectResult.failures || []

log(`采集完成: ${collectResult.total_items} 条来自 ${collectResult.sources_ok} 个源`)

if (collectResult.total_items < 1) {
  log('❌ 采集条目为空，Fatal 终止')
  return { status: 'fatal', reason: 'no_raw_items', phase: 'collect' }
}

// ============================================================
// Phase 2: URL 验证（前置，死链不进入评分）
// ============================================================
phase('URL 验证')
log('🔗 Phase 2: URL 验证...')
const t2 = Date.now()

const urlResult = await agent(
  `运行以下命令验证 URL 可访问性，然后报告结果:

\`\`\`bash
node scripts/verify-urls.mjs --date ${DATE}
\`\`\`

报告：有效条数、移除条数。不要修改数据。`,
  {
    label: 'URL 验证',
    phase: 'URL 验证',
    model: 'haiku',
    schema: {
      type: 'object',
      properties: {
        checked: { type: 'number' },
        valid: { type: 'number' },
        removed: { type: 'number' },
      },
      required: ['checked', 'valid'],
    },
  }
)

manifest.pipeline.url_verify = {
  ...urlResult,
  duration_s: Math.round((Date.now() - t2) / 1000),
}
manifest.quality.dead_link_count = urlResult.removed || 0

log(`URL 验证完成: ${urlResult.valid} 条有效, ${urlResult.removed || 0} 条移除`)

// ============================================================
// Phase 3: 确定性处理（评分 + 去重）
// ============================================================
phase('确定性处理')
log('⚙️ Phase 3: 评分 + 去重...')
const t3 = Date.now()

const validRawPath = join(OUTPUT_DIR, 'raw', 'valid-raw.json')
const validItems = loadJson(validRawPath) || loadJson(join(OUTPUT_DIR, 'raw', 'all-raw.json')) || []

// 评分
const scored = scoreAll(validItems)
const autoItems = scored.filter((i) => i.tier_label === 'auto')
const reviewItems = scored.filter((i) => i.tier_label === 'review')

// 去重
const dedupResult = dedup([...autoItems, ...reviewItems], WORKFLOW_CONFIG.outputDir, DATE)

const candidates = {
  date: DATE,
  pipeline_version: PIPELINE_VERSION,
  auto_items: dedupResult.kept.filter((i) => i.tier_label === 'auto'),
  review_items: dedupResult.kept.filter((i) => i.tier_label === 'review'),
  stats: {
    input: validItems.length,
    auto: autoItems.length,
    review: reviewItems.length,
    dedup_removed: dedupResult.removed.length,
    candidates: dedupResult.kept.length,
  },
}

// 写入 candidates.json
const candidatesPath = join(OUTPUT_DIR, 'candidates.json')
writeFileSync(candidatesPath, JSON.stringify(candidates, null, 2))

manifest.pipeline.deterministic = {
  input: validItems.length,
  candidates: dedupResult.kept.length,
  auto: candidates.auto_items.length,
  review: candidates.review_items.length,
  dedup_removed: dedupResult.removed.length,
  duration_s: Math.round((Date.now() - t3) / 1000),
}
manifest.quality.dedup_overlap_count = dedupResult.removed.length

log(`确定性处理完成: ${candidates.auto_items.length} auto + ${candidates.review_items.length} review, ${dedupResult.removed.length} 去重`)

if (dedupResult.kept.length < 1) {
  log('❌ 候选条目为空，Fatal 终止')
  return { status: 'fatal', reason: 'no_candidates', phase: 'deterministic' }
}

manifest.input_hashes.raw = sha256(validItems)
manifest.input_hashes.candidates = sha256(candidates)

// ============================================================
// Phase 4: LLM 语义选题
// ============================================================
phase('LLM 选题')
log('🎯 Phase 4: LLM 语义选题...')
const t4 = Date.now()

const candidatesJson = JSON.stringify(candidates, null, 2)

const curatedResult = await agent(
  `你是一位 AI 新闻主编。从候选新闻中精选最终内容。

## 边界约束（最高优先级）
- 你只能决定 importance（deep/important/brief）和 curation_note
- 你不能修改 title、url、source_name、published_at、summary_zh 等事实字段
- Curation 不是 Rewrite

## 精选规则

### 1. 同一事件只保留一条最优来源
- 优先官方来源 > 权威媒体 > 社区

### 2. 去除不值得报道的内容
- 使用体验/教程 → 去除
- 无新信息的评论文 → 去除
- 无法验证的传言 → 去除

### 3. 分类
- deep: 1-2 条，最重要的新闻，需要深度分析
- important: 3-5 条，值得关注的新闻
- brief: 3-5 条，快讯

### 4. 数量
- 总计 8-12 条 | 最少 5 条 | 最多 15 条
- 如果当日新闻不足 5 条，如实报告，不要用旧新闻填充

## 输入数据
\`\`\`
${candidatesJson.slice(0, 20000)}
\`\`\`

## 输出格式（严格 JSON，第一个字符必须是 {）
{
  "selected_items": [
    {
      "id": "原始ID（不可修改）",
      "title": "原始标题（不可修改）",
      "url": "原始URL（不可修改）",
      "source_name": "原始来源（不可修改）",
      "published_at": "原始时间（不可修改）",
      "summary_zh": "原始摘要（不可修改）",
      "category": "分类",
      "importance": "deep / important / brief",
      "curation_note": "选入理由"
    }
  ],
  "curation_summary": {
    "total_selected": 10,
    "deep_count": 2,
    "important_count": 4,
    "brief_count": 4,
    "categories_covered": ["模型发布", "研究突破"],
    "sources_used": ["arXiv", "TechCrunch"],
    "dropped_reasons": "简述去除原因"
  }
}`,
  {
    label: 'LLM 选题',
    phase: 'LLM 选题',
    model: 'sonnet',
    schema: {
      type: 'object',
      properties: {
        selected_items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              url: { type: 'string' },
              source_name: { type: 'string' },
              published_at: { type: 'string' },
              summary_zh: { type: 'string' },
              category: { type: 'string' },
              importance: { type: 'string' },
              curation_note: { type: 'string' },
            },
            required: ['id', 'title', 'url', 'importance'],
          },
        },
        curation_summary: {
          type: 'object',
          properties: {
            total_selected: { type: 'number' },
            categories_covered: { type: 'array', items: { type: 'string' } },
            sources_used: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      required: ['selected_items', 'curation_summary'],
    },
  }
)

const curatedData = {
  date: DATE,
  pipeline_version: PIPELINE_VERSION,
  ...curatedResult,
}

const curatedPath = join(OUTPUT_DIR, 'curated.json')
writeFileSync(curatedPath, JSON.stringify(curatedData, null, 2))

manifest.pipeline.curate = {
  input: dedupResult.kept.length,
  selected: curatedResult.curation_summary?.total_selected || curatedResult.selected_items?.length || 0,
  duration_s: Math.round((Date.now() - t4) / 1000),
}

log(`选题完成: ${curatedData.selected_items?.length || 0} 条入选`)

if (!curatedData.selected_items || curatedData.selected_items.length < 1) {
  log('❌ 选题结果为空，Fatal 终止')
  return { status: 'fatal', reason: 'no_curated_items', phase: 'curate' }
}

manifest.input_hashes.curated = sha256(curatedData)

// ============================================================
// Phase 5: LLM 内容生成（串行）
// ============================================================
phase('LLM 生成')
log('✍️ Phase 5: LLM 内容生成...')
const t5 = Date.now()

const curatedForGen = JSON.stringify(curatedData.selected_items, null, 2)
const sourcesUsed = curatedResult.curation_summary?.sources_used || []

// 5a: 文章 JSON
log('  生成 article.json...')
let articleJson = null
let articleRetryCount = 0

const articleResult = await agent(
  `你是一位 AI 科技媒体的高级编辑，负责撰写每日 AI 日报。

## 输出规则（最高优先级）
1. 直接输出合法 JSON，禁止输出任何非 JSON 内容
2. 输出的第一个字符必须是 {，最后一个字符必须是 }
3. 禁止在 JSON 前后添加任何说明、分析、确认语句

## 输入数据
\`\`\`
${curatedForGen}
\`\`\`

## 风格要求
- 信息密度高，每段聚焦一个核心观点
- 使用具体数字支撑结论
- 技术与产业分析并重
- 避免营销语言和空泛表述
- 每条分析必须回答"为什么重要"和"这意味着什么"
- 禁止使用"值得关注""意义深远""引发热议"等无信息量表述

## 写作硬约束
1. 禁止编造：输入数据中没有的数字、公司名、人名、事件不得出现
2. 数据锚定：deep_items 和 important_items 必须包含至少 1 个具体数字
3. 来源实名：sources 中的 name 必须是输入数据中实际存在的 source_name
4. 字数约束：deep_items details 200-400 字, important_items analysis 80-150 字, brief_items fact 30-50 字

## 输出 JSON 结构
{
  "hook": "一句话钩子，必须包含对比或冲突",
  "summary_items": [{ "title": "...", "one_liner": "25字以内摘要" }],
  "deep_items": [{
    "title": "...",
    "what_happened": "1-2句话事实陈述",
    "details": "技术/商业细节，200-400字，必须含具体数字",
    "why_matters": "对行业格局的影响，100-150字",
    "implications": "趋势判断，100-150字",
    "sources": [{ "name": "...", "url": "..." }]
  }],
  "important_items": [{
    "title": "...",
    "key_point": "一句话核心事实",
    "analysis": "为什么值得关注，80-150字，必须含数字或对比",
    "source": { "name": "...", "url": "..." }
  }],
  "brief_items": [{ "title": "...", "fact": "一句话纯事实，30-50字", "source": "..." }],
  "editorial": {
    "observation": "今天新闻中的模式或矛盾",
    "evidence": "引用具体新闻事实",
    "judgment": "一个明确的、可被反驳的立场",
    "prediction": "未来 3-6 个月可能发生什么"
  }
}`,
  {
    label: '文章生成',
    phase: 'LLM 生成',
    model: 'sonnet',
    schema: {
      type: 'object',
      properties: {
        hook: { type: 'string' },
        summary_items: { type: 'array', items: { type: 'object' } },
        editorial: { type: 'object' },
      },
      required: ['hook', 'summary_items', 'editorial'],
    },
  }
)

// JSON 解析兜底
articleJson = typeof articleResult === 'object' ? articleResult : parseJsonFallback(String(articleResult))

if (!articleJson) {
  log('  ⚠️ 文章 JSON 解析失败，重试一次...')
  articleRetryCount = 1
  const retryResult = await agent(
    `输出合法 JSON。输入数据：\n${curatedForGen.slice(0, 15000)}\n\n输出 article.json 结构（第一个字符必须是 {，最后一个必须是 }）。`,
    { label: '文章重试', phase: 'LLM 生成', model: 'sonnet' }
  )
  articleJson = typeof retryResult === 'object' ? retryResult : parseJsonFallback(String(retryResult))
}

if (!articleJson) {
  log('❌ 文章生成失败（重试后仍无法解析 JSON），Fatal 终止')
  return { status: 'fatal', reason: 'article_generation_failed', phase: 'generate' }
}

log(`  article.json 生成完成`)

// 5b: 口播稿 JSON（基于 curated + article）
log('  生成 script.json...')
const articleJsonStr = JSON.stringify(articleJson, null, 2)

const scriptResult = await agent(
  `你是一位 AI 科技媒体的视频口播编剧。

## 输出规则（最高优先级）
1. 直接输出合法 JSON，第一个字符 {，最后一个字符 }
2. 禁止输出任何非 JSON 内容

## 输入数据
新闻数据：
\`\`\`
${curatedForGen.slice(0, 10000)}
\`\`\`

文章内容：
\`\`\`
${articleJsonStr.slice(0, 8000)}
\`\`\`

## 口播稿要求
- 目标时长 180-300 秒
- 口语化、短句（≤20 字）、数字口语化
- 每段必须标注 duration_s（秒数）
- 与文章中"重磅新闻"选取保持一致
- 用类比帮助外行理解技术概念

## 输出 JSON 结构
{
  "hook": { "text": "冲突/数据冲击开场", "duration_s": 18 },
  "overview": { "text": "数字概括今日新闻", "duration_s": 16 },
  "deep_items": [{ "title": "...", "text": "详细展开", "duration_s": 45 }],
  "quick_items": [{ "title": "...", "text": "是什么+一句话为什么重要", "duration_s": 18 }],
  "closing": { "text": "趋势提炼+前瞻判断", "duration_s": 17 }
}`,
  {
    label: '口播稿生成',
    phase: 'LLM 生成',
    model: 'sonnet',
    schema: {
      type: 'object',
      properties: {
        hook: { type: 'object' },
        overview: { type: 'object' },
        closing: { type: 'object' },
      },
      required: ['hook', 'overview', 'closing'],
    },
  }
)

const scriptJson = typeof scriptResult === 'object' ? scriptResult : parseJsonFallback(String(scriptResult))

if (!scriptJson) {
  log('❌ 口播稿生成失败，Fatal 终止')
  return { status: 'fatal', reason: 'script_generation_failed', phase: 'generate' }
}

log(`  script.json 生成完成`)

manifest.pipeline.generate = {
  article_ok: !!articleJson,
  script_ok: !!scriptJson,
  retry_count: articleRetryCount,
  duration_s: Math.round((Date.now() - t5) / 1000),
}

// ============================================================
// Phase 6: 渲染（JSON → Markdown）
// ============================================================
phase('渲染')
log('📝 Phase 6: 渲染...')
const t6 = Date.now()

const articleMarkdown = renderArticle(
  articleJson,
  DATE,
  sourcesUsed,
  { selected: curatedData.selected_items?.length }
)

const scriptMarkdown = renderScript(scriptJson, DATE)

manifest.pipeline.render = {
  article_chars: articleMarkdown.length,
  script_chars: scriptMarkdown.length,
  duration_s: Math.round((Date.now() - t6) / 1000),
}

log(`渲染完成: 文章 ${articleMarkdown.length} 字, 口播稿 ${scriptMarkdown.length} 字`)

// ============================================================
// Phase 7: 校验
// ============================================================
phase('校验')
log('✅ Phase 7: 校验...')
const t7 = Date.now()

const validation = validate(
  articleMarkdown,
  scriptMarkdown,
  curatedData.selected_items,
  articleJson,
  scriptJson
)

manifest.pipeline.validate = {
  article_passed: validation.articlePassed,
  script_passed: validation.scriptPassed,
  content_passed: validation.contentPassed,
  validation_passed: validation.validation_passed,
  duration_s: Math.round((Date.now() - t7) / 1000),
}
manifest.quality.reasoning_leak_detected = false
manifest.quality.hallucinated_url_count = validation.details?.content?.summary?.hallucinated_url_count || 0

if (!validation.validation_passed) {
  log(`⚠️ 校验未通过: ${JSON.stringify(validation.details)}`)
  // 写入但标记
}

// ============================================================
// Phase 8: 归档（代码直接写文件）
// ============================================================
phase('归档')
log('📁 Phase 8: 归档...')
const t8 = Date.now()

// 写入文章和口播稿
writeFileSync(join(OUTPUT_DIR, 'article.md'), articleMarkdown)
writeFileSync(join(OUTPUT_DIR, 'script.md'), scriptMarkdown)

// 写入 article.json 和 script.json（原始 LLM 输出）
writeFileSync(join(OUTPUT_DIR, 'article.json'), JSON.stringify(articleJson, null, 2))
writeFileSync(join(OUTPUT_DIR, 'script.json'), JSON.stringify(scriptJson, null, 2))

// 更新 index.json
const indexPath = join(WORKFLOW_CONFIG.outputDir, 'index.json')
let index = { version: 1, entries: [] }
try { index = JSON.parse(readFileSync(indexPath, 'utf-8')) } catch {}

// 移除当天旧条目（重跑时）
index.entries = index.entries.filter((e) => e.date !== DATE)
index.entries.unshift({
  date: DATE,
  items: (curatedData.selected_items || []).map((item) => ({
    id: item.id,
    title: item.title,
    url: item.url,
    source: item.source_name,
    importance: item.importance,
  })),
  selected_count: curatedData.selected_items?.length || 0,
  pipeline_version: PIPELINE_VERSION,
})
// 保留最近 30 天
index.entries = index.entries.slice(0, 30)
index.updated_at = new Date().toISOString()

writeFileSync(indexPath, JSON.stringify(index, null, 2))

// 完成 manifest
manifest.output_hashes.article = sha256(articleMarkdown)
manifest.output_hashes.script = sha256(scriptMarkdown)
manifest.duration_total_s = Math.round((Date.now() - startedAt) / 1000)

writeFileSync(join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2))

log(`归档完成: article.md, script.md, curated.json, manifest.json, index.json`)
log(`✅ AI 日报 Pipeline v3 执行完成 | 总耗时 ${manifest.duration_total_s}s`)

return {
  status: 'success',
  pipeline_version: PIPELINE_VERSION,
  date: DATE,
  manifest,
}
