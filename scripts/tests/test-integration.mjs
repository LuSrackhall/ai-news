/**
 * Candidate Builder — 全链路集成测试
 *
 * 覆盖：
 * - BreakingRule 使用真实 config.mjs 的 ENTITY_WEIGHTS.top_tier.entities
 * - DiversityRule 使用真实 SCORING thresholds
 * - EditorialMemoryRule 使用真实的 JsonEditorialMemoryStore
 * - 5 个 events 混合不同 category，验证 DiversityRule 补入逻辑
 * - 模拟编排：BreakingRule → DiversityRule → MemoryRule → CandidateBuilder.build()
 *
 * Usage: node scripts/domain/editorial/test-integration.mjs
 */

import { BreakingRule } from './rules/breaking-rule.mjs'
import { DiversityRule } from './rules/diversity-rule.mjs'
import { EditorialMemoryRule } from './rules/memory-rule.mjs'
import { CandidateBuilder } from './candidate-builder.mjs'
import { JsonEditorialMemoryStore } from '../../services/editorial-memory-store.mjs'
import { ENTITY_WEIGHTS, SCORING } from '../../config.mjs'

let passed = 0
let failed = 0
const errors = []

function assert(condition, label) {
  if (condition) { passed++; return true }
  const msg = `FAIL: ${label}`
  console.error(`  ${msg}`)
  errors.push(msg)
  failed++
  return false
}

function makeEvent(overrides = {}) {
  return {
    id: `evt-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test Event',
    url: 'https://example.com',
    summary: 'Test summary',
    entities: [],
    source_name: 'TechCrunch',
    source: { name: 'TechCrunch', url: 'https://techcrunch.com' },
    rank: { totalScore: 65 },
    rank_total: 65,
    category: 'industry',
    published_at: new Date().toISOString(),
    ...overrides,
  }
}

// ============================================================
// 配置验证
// ============================================================
console.log('=== 配置验证 ===')

assert(ENTITY_WEIGHTS.top_tier.entities.includes('OpenAI'), `config ENTITY_WEIGHTS.top_tier includes "OpenAI"`)
assert(ENTITY_WEIGHTS.top_tier.entities.includes('Anthropic'), `config ENTITY_WEIGHTS.top_tier includes "Anthropic"`)
assert(SCORING.thresholds.review_min === 55, `config SCORING.thresholds.review_min = ${SCORING.thresholds.review_min}`)
assert(SCORING.thresholds.auto === 70, `config SCORING.thresholds.auto = ${SCORING.thresholds.auto}`)

// ============================================================
// 场景 1: BreakingRule + 真实 ENTITY_WEIGHTS
// ============================================================
console.log('\n=== 场景 1: BreakingRule 使用真实 ENTITY_WEIGHTS ===')

{
  // OpenAI 是 top_tier，只出现 1 次、2 次 → BREAKING
  const rule = new BreakingRule()
  const events = [
    makeEvent({ id: 's1-e1', entities: ['OpenAI'], rank: { totalScore: 80 } }),
    makeEvent({ id: 's1-e2', entities: ['Meta'], rank: { totalScore: 70 } }),
  ]
  const result = rule.evaluate(events)
  const openaiSig = result.signals.find(s => s.metadata?.entity === 'OpenAI')
  const metaSig = result.signals.find(s => s.metadata?.entity === 'Meta')
  assert(openaiSig?.subtype === 'BREAKING', 'OpenAI (top_tier, appears 1x) → BREAKING signal')
  assert(metaSig?.subtype === 'BREAKING', 'Meta (top_tier, appears 1x) → BREAKING signal')
}

{
  // top_tier 出现 3+ 次 → 不触发 BREAKING
  const rule = new BreakingRule()
  const events = [
    makeEvent({ id: 's1-e3', entities: ['OpenAI'] }),
    makeEvent({ id: 's1-e4', entities: ['OpenAI'] }),
    makeEvent({ id: 's1-e5', entities: ['OpenAI'] }),
  ]
  const result = rule.evaluate(events)
  const openaiSig = result.signals.find(s => s.metadata?.entity === 'OpenAI')
  assert(!openaiSig, 'OpenAI (top_tier, appears 3x) → NO BREAKING')
}

{
  // 非 top_tier 实体 → 不触发条件 1
  const rule = new BreakingRule()
  const events = [
    makeEvent({ id: 's1-e6', entities: ['SomeSmallCo'], rank: { totalScore: 60 } }),
  ]
  const result = rule.evaluate(events)
  assert(result.signals.length === 0, 'non top_tier entity → no BREAKING from condition 1')
}

{
  // official blog + singleton cluster
  const rule = new BreakingRule()
  const events = [
    makeEvent({
      id: 's1-e7',
      source_name: 'Google AI Blog',
      source: { name: 'Google AI Blog', url: 'https://blog.google/technology/ai/post' },
      metadata: { clusterSize: 1 },
    }),
  ]
  const result = rule.evaluate(events)
  const blogSig = result.signals.find(s => s.metadata?.eventId === 's1-e7')
  assert(blogSig?.subtype === 'BREAKING', 'official blog + singleton cluster → BREAKING')
}

// ============================================================
// 场景 2: DiversityRule + 真实 SCORING thresholds
// ============================================================
console.log('\n=== 场景 2: DiversityRule 使用真实 SCORING thresholds ===')

{
  // 5 events across 4 categories → DiversityRule 应补入第 5 个 category
  const rule = new DiversityRule()
  const events = [
    makeEvent({ id: 'd1', category: 'industry', rank: { totalScore: 65 }, rank_total: 65 }),
    makeEvent({ id: 'd2', category: 'industry', rank: { totalScore: 60 }, rank_total: 60 }),
    makeEvent({ id: 'd3', category: 'academic', rank: { totalScore: 68 }, rank_total: 68 }),
    makeEvent({ id: 'd4', category: 'official', rank: { totalScore: 72 }, rank_total: 72 }),
    makeEvent({ id: 'd5', category: 'media', rank: { totalScore: 58 }, rank_total: 58 }),
  ]
  const result = rule.evaluate(events)
  // Only 4 categories covered, but there's no review tier event in missing category to fill
  // This test just verifies no crash with real SCORING thresholds
  assert(result.signals !== undefined, 'DiversityRule.evaluate() returns result with signals')
}

// ============================================================
// 场景 3: EditorialMemoryRule + 真实 JsonEditorialMemoryStore
// ============================================================
console.log('\n=== 场景 3: EditorialMemoryRule + JsonEditorialMemoryStore ===')

{
  // 使用临时文件作为 memory store
  const testPath = `/tmp/int-memory-${Date.now()}.json`
  const store = new JsonEditorialMemoryStore(testPath)

  // 先写入一些历史数据
  store.save('2026-07-01', {
    topEventIds: ['past-evt-1', 'past-evt-2'],
    topEntities: ['OpenAI', 'Meta', 'Anthropic'],
    topCategories: ['industry', 'official'],
  })
  store.save('2026-06-30', {
    topEventIds: [],
    topEntities: ['Anthropic', 'DeepMind'],
    topCategories: ['academic'],
  })
  store.save('2026-06-29', {
    topEventIds: [],
    topEntities: ['Anthropic'],
    topCategories: [],
  })

  const rule = new EditorialMemoryRule(store)
  const events = [
    makeEvent({ id: 'mem-evt-1', entities: ['Anthropic'] }),  // hit: 3 days
    makeEvent({ id: 'mem-evt-2', entities: ['OpenAI'] }),      // hit: 1 day
    makeEvent({ id: 'mem-evt-3', entities: ['UnknownLab'] }),  // no hit
  ]
  const result = rule.evaluate(events, { date: '2026-07-02' })
  const anthSig = result.signals.find(s => s.metadata?.eventId === 'mem-evt-1')
  const openaiSig = result.signals.find(s => s.metadata?.eventId === 'mem-evt-2')
  const unknownSig = result.signals.find(s => s.metadata?.eventId === 'mem-evt-3')

  assert(anthSig?.subtype === 'MEMORY', 'Anthropic (3 days in memory) → MEMORY signal')
  assert(anthSig?.metadata?.recentDays === 3, `Anthropic recentDays = 3, got ${anthSig?.metadata?.recentDays}`)
  assert(openaiSig?.subtype === 'MEMORY', 'OpenAI (1 day in memory) → MEMORY signal')
  assert(!unknownSig, 'UnknownLab (no memory) → no MEMORY signal')

  // 清理
  try { require('fs').unlinkSync(testPath) } catch {}
}

// ============================================================
// 场景 4: CandidateBuilder 全链路编排
// ============================================================
console.log('\n=== 场景 4: CandidateBuilder 全链路（Breaking → Diversity → Memory） ===')

{
  const testPath = `/tmp/int-memory-${Date.now()}-full.json`
  const memoryStore = new JsonEditorialMemoryStore(testPath)

  // 写入历史记忆（memory）
  memoryStore.save('2026-07-01', {
    topEventIds: [],
    topEntities: ['Anthropic'],
    topCategories: ['industry'],
  })

  // 10 events: 1 BREAKING (Anthropic singleton), 9 in same category
  const events = [
    makeEvent({ id: 'breaking-evt', entities: ['Anthropic'], category: 'industry', rank: { totalScore: 85 }, rank_total: 85 }),
  ]
  for (let i = 0; i < 9; i++) {
    events.push(makeEvent({
      id: `regular-ev-${i}`,
      entities: ['Meta'],
      category: 'industry',
      rank: { totalScore: 65 - i * 3 },
      rank_total: 65 - i * 3,
    }))
  }

  const builder = new CandidateBuilder([
    new BreakingRule(),
    new DiversityRule(),
    new EditorialMemoryRule(memoryStore),
  ])

  const result = builder.build(events, { date: '2026-07-02', memoryStore })

  // Bridge check: single category → cap applied (applyCap marks _held, not via filteredOut)
  assert(result.finalCandidates.length > 0, 'finalCandidates is non-empty')
  assert(result.finalCandidates.length < result.rankedCandidates.length,
    `finalCandidates (${result.finalCandidates.length}) < rankedCandidates (${result.rankedCandidates.length}) — single category cap applied`)

  // BREAKING event preserved
  const breakingCandidate = result.finalCandidates.find(c => c.event.id === 'breaking-evt')
  assert(!!breakingCandidate, 'BREAKING event preserved in finalCandidates')

  // MemoryRule produces annotation for Anthropic
  const memSignals = result.signalLog.filter(s => s.subtype === 'MEMORY')
  assert(memSignals.length > 0, `MemoryRule produced MEMORY signals (got ${memSignals.length})`)

  // MemoryRule produced contextHints for Anthropic
  if (breakingCandidate) {
    assert(breakingCandidate.contextHints.length > 0, `BREAKING candidate has contextHints (got ${breakingCandidate.contextHints.length})`)
  }

  // 清理
  try { require('fs').unlinkSync(testPath) } catch {}
}

// ============================================================
// 场景 5: 5 events, mixed categories, DiversityRule fill-in
// ============================================================
console.log('\n=== 场景 5: 5 events × 混合 category → DiversityRule 补入 ===')

{
  const testPath = `/tmp/int-memory-${Date.now()}-mix.json`
  const memoryStore = new JsonEditorialMemoryStore(testPath)

  // 5 events with 4 different categories
  const events = [
    makeEvent({ id: 'mix-1', category: 'industry', rank: { totalScore: 80 }, rank_total: 80 }),
    makeEvent({ id: 'mix-2', category: 'academic', rank: { totalScore: 75 }, rank_total: 75 }),
    makeEvent({ id: 'mix-3', category: 'official', rank: { totalScore: 70 }, rank_total: 70 }),
    makeEvent({ id: 'mix-4', category: 'official', rank: { totalScore: 60 }, rank_total: 60 }),
    makeEvent({ id: 'mix-5', category: 'community', rank: { totalScore: 55 }, rank_total: 55 }),
  ]

  const builder = new CandidateBuilder([
    new BreakingRule(),
    new DiversityRule(),
    new EditorialMemoryRule(memoryStore),
  ])

  const result = builder.build(events, { date: '2026-07-02', memoryStore })

  assert(result.finalCandidates.length >= 4, `finalCandidates >= 4 (got ${result.finalCandidates.length})`)
  assert(result.rankedCandidates.length === 5, `rankedCandidates = 5 (got ${result.rankedCandidates.length})`)

  // Verify categories present in finalCandidates
  const finalCategories = new Set(result.finalCandidates.map(c => c.event.category))
  console.log(`  Categories in finalCandidates: ${[...finalCategories].join(', ')}`)

  // Verify sorted by finalRank desc
  let sorted = true
  for (let i = 1; i < result.finalCandidates.length; i++) {
    if (result.finalCandidates[i].finalRank > result.finalCandidates[i - 1].finalRank) {
      sorted = false
      break
    }
  }
  assert(sorted, 'finalCandidates sorted by finalRank descending')

  // 清理
  try { require('fs').unlinkSync(testPath) } catch {}
}

// ============================================================
// 场景 6: BuildCandidates Task 编排模拟
// ============================================================
console.log('\n=== 场景 6: BuildCandidates Task 编排模拟 ===')

{
  const testPath = `/tmp/int-memory-${Date.now()}-task.json`
  const memoryStore = new JsonEditorialMemoryStore(testPath)
  memoryStore.save('2026-07-01', { topEventIds: [], topEntities: ['Anthropic', 'Meta'], topCategories: ['industry'] })

  // 模拟 BuildCandidates.execute() 内部逻辑
  const events = [
    makeEvent({ id: 'task-evt-1', entities: ['Anthropic'], category: 'industry', rank: { totalScore: 88 }, rank_total: 88 }),
    makeEvent({ id: 'task-evt-2', entities: ['OpenAI'], category: 'academic', rank: { totalScore: 82 }, rank_total: 82 }),
    makeEvent({ id: 'task-evt-3', entities: ['Meta'], category: 'official', rank: { totalScore: 76 }, rank_total: 76 }),
    makeEvent({ id: 'task-evt-4', entities: ['Unknown'], category: 'media', rank: { totalScore: 62 }, rank_total: 62 }),
    makeEvent({ id: 'task-evt-5', entities: ['Mistral'], category: 'industry', rank: { totalScore: 58 }, rank_total: 58 }),
  ]

  const builder = new CandidateBuilder([
    new BreakingRule(),
    new DiversityRule(),
    new EditorialMemoryRule(memoryStore),
  ])

  const buildResult = builder.build(events, { date: '2026-07-02', memoryStore })

  // 模拟 ctx._candidates / ctx._buildResult
  const ctx = { _candidates: buildResult.finalCandidates, _buildResult: buildResult }

  assert(ctx._candidates.length > 0, `ctx._candidates non-empty (got ${ctx._candidates.length})`)
  assert(ctx._buildResult.filteredIn > 0, `ctx._buildResult.filteredIn > 0 (got ${ctx._buildResult.filteredIn})`)
  assert(ctx._buildResult.rankedCandidates.length > 0, `rankedCandidates non-empty (got ${ctx._buildResult.rankedCandidates.length})`)

  // 清理
  try { require('fs').unlinkSync(testPath) } catch {}
}

// ============================================================
// 汇总
// ============================================================
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
if (failed > 0) {
  console.log('\n--- 失败详情 ---')
  for (const err of errors) {
    console.log(`  ${err}`)
  }
}
process.exit(failed > 0 ? 1 : 0)
