/**
 * CandidateBuilder 演示脚本
 * 模拟一天的事件，展示 CandidateBuilder 的三条 Rule 效果
 *
 * 用法: node scripts/domain/editorial/demo-candidate-builder.mjs
 */

import { CandidateBuilder } from './candidate-builder.mjs'
import { BreakingRule } from './rules/breaking-rule.mjs'
import { DiversityRule } from './rules/diversity-rule.mjs'
import { EditorialMemoryRule } from './rules/memory-rule.mjs'
import { createRuleContext } from './rule-context.mjs'
import { JsonEditorialMemoryStore } from '../../services/editorial-memory-store.mjs'

// 模拟 15 条事件
const events = [
  { id: 'evt-1', title: 'OpenAI 发布 GPT-6', entities: ['OpenAI'], category: 'model', rank: { totalScore: 95 }, rank_total: 95, source_name: 'OpenAI Blog', source: { name: 'OpenAI Blog', url: 'https://openai.com/blog' }, metadata: { clusterSize: 1 } },
  { id: 'evt-2', title: 'Anthropic 推出新模型', entities: ['Anthropic'], category: 'model', rank: { totalScore: 88 }, rank_total: 88, source_name: 'TechCrunch', source: { name: 'TechCrunch', url: 'https://techcrunch.com' } },
  { id: 'evt-3', title: 'Meta 发布 Llama 4', entities: ['Meta'], category: 'model', rank: { totalScore: 82 }, rank_total: 82, source_name: 'Meta AI', source: { name: 'Meta AI', url: 'https://ai.meta.com' }, metadata: { clusterSize: 1 } },
  { id: 'evt-4', title: 'Google 回应 Gemini 更新', entities: ['Google'], category: 'model', rank: { totalScore: 75 }, rank_total: 75, source_name: 'The Verge', source: { name: 'The Verge', url: 'https://theverge.com' } },
  { id: 'evt-5', title: '软银百亿美元贷款', entities: ['OpenAI'], category: 'funding', rank: { totalScore: 72 }, rank_total: 72, source_name: '36氪', source: { name: '36氪', url: 'https://36kr.com' } },
  { id: 'evt-6', title: '美团国产算力大模型', entities: ['美团'], category: 'product', rank: { totalScore: 70 }, rank_total: 70, source_name: '虎嗅', source: { name: '虎嗅', url: 'https://huxiu.com' } },
  { id: 'evt-7', title: '天工AI ARR 8亿', entities: ['天工AI'], category: 'funding', rank: { totalScore: 65 }, rank_total: 65, source_name: '量子位', source: { name: '量子位', url: 'https://qbitai.com' } },
  { id: 'evt-8', title: 'NVIDIA 开放基础设施', entities: ['NVIDIA'], category: 'industry', rank: { totalScore: 68 }, rank_total: 68, source_name: 'NVIDIA Blog', source: { name: 'NVIDIA Blog', url: 'https://blogs.nvidia.com' }, metadata: { clusterSize: 1 } },
  { id: 'evt-9', title: '苹果自研端侧AI芯片', entities: ['Apple'], category: 'product', rank: { totalScore: 63 }, rank_total: 63, source_name: 'Wired AI', source: { name: 'Wired AI', url: 'https://wired.com' } },
  { id: 'evt-10', title: '美政府推安全标准', entities: [], category: 'policy', rank: { totalScore: 60 }, rank_total: 60, source_name: '36氪', source: { name: '36氪', url: 'https://36kr.com' } },
  { id: 'evt-11', title: '研究突破：新算法', entities: [], category: 'research', rank: { totalScore: 58 }, rank_total: 58, source_name: 'arXiv', source: { name: 'arXiv', url: 'https://arxiv.org' } },
  // 以下为同一 category 超上限的填充
  { id: 'evt-12', title: '芯片新闻 A', entities: [], category: 'industry', rank: { totalScore: 50 }, rank_total: 50, source_name: '36氪', source: { name: '36氪', url: 'https://36kr.com' } },
  { id: 'evt-13', title: '芯片新闻 B', entities: [], category: 'industry', rank: { totalScore: 48 }, rank_total: 48, source_name: '36氪', source: { name: '36氪', url: 'https://36kr.com' } },
  { id: 'evt-14', title: '芯片新闻 C', entities: [], category: 'industry', rank: { totalScore: 45 }, rank_total: 45, source_name: '36氪', source: { name: '36氪', url: 'https://36kr.com' } },
  { id: 'evt-15', title: '芯片新闻 D', entities: [], category: 'industry', rank: { totalScore: 42 }, rank_total: 42, source_name: '36氪', source: { name: '36氪', url: 'https://36kr.com' } },
]

// 预置 Memory：OpenAI 已连续 3 天报道
const testMemoryPath = `/tmp/editorial-memory-demo-${Date.now()}.json`
import { writeFileSync } from 'node:fs'
writeFileSync(testMemoryPath, JSON.stringify({
  version: 1,
  days: {
    '2026-06-30': { topEventIds: [], topEntities: ['OpenAI'], topCategories: [] },
    '2026-07-01': { topEventIds: [], topEntities: ['OpenAI', 'Meta'], topCategories: [] },
    '2026-07-02': { topEventIds: [], topEntities: ['OpenAI', 'Google'], topCategories: [] },
  },
}))

const memoryStore = new JsonEditorialMemoryStore(testMemoryPath)
const ruleContext = createRuleContext({ date: '2026-07-03', memoryStore })

const builder = new CandidateBuilder([
  new BreakingRule(),
  new DiversityRule(),
  new EditorialMemoryRule(memoryStore),
])

console.log('╔══════════════════════════════════════════════╗')
console.log('║     Candidate Builder — 演示运行             ║')
console.log('╚══════════════════════════════════════════════╝')
console.log(`输入: ${events.length} 条事件\n`)

const result = builder.build(events, ruleContext)

// 展示 Signal Log
console.log('── Signal Log ──')
for (const sig of result.signalLog) {
  console.log(`  [${sig.phase}] ${sig.subtype.padEnd(14)} ${sig.source.padEnd(16)} ${sig.reason}`)
}

console.log(`\n── Filter 结果 ──`)
console.log(`  Filtered In:  ${result.filteredIn}`)
console.log(`  Filtered Out: ${result.filteredOut}`)

console.log(`\n── Final Candidates (${result.finalCandidates.length}) ──`)
console.log('  Rank  | Event ID      | 事件')
for (const c of result.finalCandidates) {
  const hints = c.contextHints.length > 0 ? ` ⚠ ${c.contextHints[0].slice(0, 40)}...` : ''
  console.log(`  ${String(c.finalRank).padEnd(5)} | ${c.event.id.padEnd(13)} | ${c.event.title}${hints}`)
}

console.log('\n── Rule 效果验证 ──')

// 验证 Breaking：OpenAI 是 top_tier 实体 + 当天出现 2 次（≤ 2）→ BREAKING
const breakingSigs = result.signalLog.filter((s) => s.subtype === 'BREAKING')
console.log(`  BreakingRule 触发: ${breakingSigs.length} 条 (${breakingSigs.map((s) => s.metadata?.entity || s.metadata?.eventId).join(', ')})`)

// 验证 Diversity：category 覆盖
const cats = new Set(result.finalCandidates.map((c) => c.event.category))
console.log(`  Category 覆盖: ${[...cats].join(', ')} (${cats.size} 种)`)

// 验证 Memory：OpenAI 有 contextHint
const openaiCandidate = result.finalCandidates.find((c) => c.event.id === 'evt-1')
console.log(`  OpenAI contextHints: ${openaiCandidate?.contextHints?.length || 0} 条 (memory 命中)`)

console.log('\n✅ 运行完毕')
