#!/usr/bin/env node
/**
 * AI 日报 Pipeline v3 - 模块单元测试
 * 验证各模块的基本功能
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { scoreAll } from './score.mjs'
import { computeTitleSimilarity, extractEventFingerprint } from './dedup.mjs'
import { renderArticle } from './render-article.mjs'
import { renderScript } from './render-script.mjs'
import { validate } from './validate-output.mjs'

let passed = 0
let failed = 0

function assert(condition, name) {
  if (condition) {
    console.log(`  ✅ ${name}`)
    passed++
  } else {
    console.log(`  ❌ ${name}`)
    failed++
  }
}

// ============================================================
// Test 1: 评分区分度
// ============================================================
console.log('\n📊 Test 1: 评分区分度')

const mockItems = [
  {
    id: 'deepseek-v4', sourceId: 'arxiv-cs-ai', sourceName: 'arXiv CS.AI',
    tier: 1, category: 'academic', language: 'en',
    title: 'DeepSeek-V4: Towards Highly Efficient Million-Token Context Intelligence',
    url: 'https://arxiv.org/abs/2606.19348',
    description: 'DeepSeek发布V4系列模型，含1.6T参数Pro版和284B参数Flash版，支持百万token上下文，采用新型稀疏注意力架构。',
    summary: 'DeepSeek发布V4系列模型，含1.6T参数Pro版和284B参数Flash版，支持百万token上下文。',
    publishedAt: new Date(Date.now() - 6 * 3600000).toISOString(),
  },
  {
    id: 'hidden-anchors', sourceId: 'arxiv-cs-ai', sourceName: 'arXiv CS.AI',
    tier: 1, category: 'academic', language: 'en',
    title: 'Hidden Anchors in Multi-Agent LLM Deliberation',
    url: 'https://arxiv.org/abs/2606.19494',
    description: '将多智能体LLM审议建模为闭环动力学系统，发现隐藏锚点机制可使智能体置信度超越初始信念。',
    summary: '将多智能体LLM审议建模为闭环动力学系统，发现隐藏锚点机制。',
    publishedAt: new Date(Date.now() - 8 * 3600000).toISOString(),
  },
  {
    id: 'baseten-funding', sourceId: 'techcrunch', sourceName: 'TechCrunch',
    tier: 2, category: 'media', language: 'en',
    title: 'AI inference startup Baseten reportedly raising $1.5B months after its last mega round',
    url: 'https://techcrunch.com/2026/06/18/baseten/',
    description: 'AI推理创企Baseten据报正以130亿美元估值融资15亿美元。',
    summary: 'AI推理创企Baseten据报正以130亿美元估值融资15亿美元，距上一轮巨额融资仅数月。',
    publishedAt: new Date(Date.now() - 14 * 3600000).toISOString(),
  },
]

const scored = scoreAll(mockItems)
const deepseekScore = scored.find((i) => i.id === 'deepseek-v4').scores.total
const hiddenScore = scored.find((i) => i.id === 'hidden-anchors').scores.total
const basetenScore = scored.find((i) => i.id === 'baseten-funding').scores.total

assert(deepseekScore > hiddenScore, `DeepSeek-V4 (${deepseekScore}) > Hidden Anchors (${hiddenScore})`)
assert(deepseekScore >= 70, `DeepSeek-V4 auto 级别 (${deepseekScore} >= 70)`)
assert(hiddenScore < 60, `Hidden Anchors skip 级别 (${hiddenScore} < 60)`)
assert(basetenScore > 30, `Baseten 有合理分数 (${basetenScore} > 30)`)
assert(scored.find((i) => i.id === 'deepseek-v4').tier_label === 'auto', 'DeepSeek-V4 tier_label = auto')
assert(scored.find((i) => i.id === 'hidden-anchors').tier_label === 'skip', 'Hidden Anchors tier_label = skip')

// ============================================================
// Test 2: 去重
// ============================================================
console.log('\n🔄 Test 2: 标题相似度')

const sim1 = computeTitleSimilarity(
  'DeepSeek发布V4系列模型',
  'DeepSeek正式发布V4系列模型'
)
assert(sim1 > 0.5, `相似标题相似度 ${sim1.toFixed(2)} > 0.5`)

const sim2 = computeTitleSimilarity(
  'DeepSeek发布V4系列模型',
  '挪威将禁止小学生使用生成式人工智能'
)
assert(sim2 < 0.3, `不相关标题相似度 ${sim2.toFixed(2)} < 0.3`)

// ============================================================
// Test 3: 事件指纹
// ============================================================
console.log('\n🔍 Test 3: 事件指纹')

const fp1 = extractEventFingerprint('OpenAI发布GPT-5模型', '2026-06-22T10:00:00Z')
const fp2 = extractEventFingerprint('OpenAI officially releases GPT-5', '2026-06-22T12:00:00Z')
assert(fp1.split('|')[0] === fp2.split('|')[0], `同实体指纹: ${fp1.split('|')[0]}`)

// ============================================================
// Test 4: 渲染器
// ============================================================
console.log('\n📝 Test 4: 渲染器')

const mockArticle = {
  hook: 'DeepSeek甩出1.6万亿参数，诺贝尔奖得主却转投对手',
  summary_items: [{ title: 'DeepSeek-V4', one_liner: '1.6T参数' }],
  deep_items: [{
    title: 'DeepSeek发布V4系列',
    what_happened: 'DeepSeek正式发布V4系列模型',
    details: '含1.6T参数Pro版，支持百万token上下文',
    why_matters: '百万token上下文正在从论文指标变为产品标配',
    implications: '未来6个月将看到更多高效大模型发布',
    sources: [{ name: 'arXiv', url: 'https://arxiv.org/abs/2606.19348' }],
  }],
  important_items: [{ title: 'Baseten融资', key_point: '估值130亿', analysis: '推理基础设施受追捧', source: { name: 'TechCrunch', url: 'https://techcrunch.com/...' } }],
  brief_items: [{ title: '快讯1', fact: '一句话', source: 'TechCrunch' }],
  editorial: { observation: '今天两条新闻构成对冲', evidence: 'DeepSeek用1.6T参数', judgment: '规模与效率并非零和', prediction: '未来6个月更多高效大模型' },
}

const rendered = renderArticle(mockArticle, '2026-06-22', ['arXiv', 'TechCrunch'], { selected: 10 })
assert(rendered.includes('# AI 日报 | 2026-06-22'), '包含标题')
assert(rendered.includes('## 今日速览'), '包含速览')
assert(rendered.includes('## 重磅深度'), '包含重磅深度')
assert(rendered.includes('## 重要动态'), '包含重要动态')
assert(rendered.includes('## 快讯'), '包含快讯')
assert(rendered.includes('## 编辑观点'), '包含编辑观点')
assert(rendered.includes('发生了什么'), '四段结构：发生了什么')
assert(rendered.includes('为什么重要'), '四段结构：为什么重要')
assert(rendered.includes('意味着什么'), '四段结构：意味着什么')

const mockScript = {
  hook: { text: '一点六万亿参数', duration_s: 18 },
  overview: { text: '今天3条新闻', duration_s: 16 },
  deep_items: [{ title: 'DeepSeek', text: '详细展开', duration_s: 45 }],
  quick_items: [{ title: '快讯', text: '一句话', duration_s: 18 }],
  closing: { text: '收尾', duration_s: 17 },
}

const renderedScript = renderScript(mockScript, '2026-06-22')
assert(renderedScript.includes('[开场 Hook · 18s]'), '口播稿包含时间标注')
assert(renderedScript.includes('[收尾 · 17s]'), '口播稿包含收尾')

// ============================================================
// Test 5: Schema Validation
// ============================================================
console.log('\n✅ Test 5: Schema Validation')

const validArticle = {
  hook: 'test',
  summary_items: [{ title: 't', one_liner: 'o' }],
  editorial: { observation: 'a'.repeat(40), evidence: 'b'.repeat(40), judgment: 'c'.repeat(40), prediction: 'd'.repeat(40) },
}
const valResult = validate('', '', [], validArticle, { hook: { text: 't', duration_s: 18 }, overview: { text: 't', duration_s: 16 }, closing: { text: 't', duration_s: 17 } })
assert(valResult.articlePassed, '有效 article.json Schema 通过')
assert(valResult.scriptPassed, '有效 script.json Schema 通过')

const invalidArticle = { hook: 'test' }
const valResult2 = validate('', '', [], invalidArticle, { hook: { text: 't', duration_s: 18 }, overview: { text: 't', duration_s: 16 }, closing: { text: 't', duration_s: 17 } })
assert(!valResult2.articlePassed, '无效 article.json Schema 不通过')

// ============================================================
// 汇总
// ============================================================
console.log(`\n${'='.repeat(40)}`)
console.log(`总计: ${passed + failed} 个测试, ${passed} 通过, ${failed} 失败`)
if (failed > 0) {
  process.exit(1)
} else {
  console.log('✅ 全部通过！')
}
