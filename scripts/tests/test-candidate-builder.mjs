/**
 * Candidate Builder — Test Suite
 *
 * Usage: node scripts/domain/editorial/test-candidate-builder.mjs
 */

import { BreakingRule } from './rules/breaking-rule.mjs'
import { DiversityRule } from './rules/diversity-rule.mjs'
import { EditorialMemoryRule } from './rules/memory-rule.mjs'
import { CandidateBuilder } from './candidate-builder.mjs'
import { JsonEditorialMemoryStore } from '../../services/editorial-memory-store.mjs'
import { ResolutionPolicy, SignalLog } from './signal.mjs'

let passed = 0
let failed = 0

function assert(condition, label) {
  if (condition) { passed++; return true }
  console.error(`  FAIL: ${label}`)
  failed++;
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

// ---- 7.1 BreakingRule Tests ----

console.log('\n=== 7.1 BreakingRule ===')

const breakingRule = new BreakingRule()

// Test 1: top_tier singleton → BREAKING
{
  const events = [
    makeEvent({ id: 'evt-1', entities: ['OpenAI'], rank: { totalScore: 80 } }),
    makeEvent({ id: 'evt-2', entities: ['Meta'], rank: { totalScore: 70 } }),
  ]
  // OpenAI appears only once → BREAKING
  const result = breakingRule.evaluate(events)
  const openaiSig = result.signals.find((s) => s.metadata?.entity === 'OpenAI')
  assert(openaiSig?.subtype === 'BREAKING', 'top_tier singleton → BREAKING')
}

// Test 2: top_tier entity appearing 3+ times → NO BREAKING
{
  const events = [
    makeEvent({ id: 'evt-1', entities: ['OpenAI'] }),
    makeEvent({ id: 'evt-2', entities: ['OpenAI'] }),
    makeEvent({ id: 'evt-3', entities: ['OpenAI'] }),
  ]
  // OpenAI appears 3 times → not singleton
  const result = breakingRule.evaluate(events)
  const openaiSig = result.signals.find((s) => s.metadata?.entity === 'OpenAI')
  assert(!openaiSig, 'high frequency entity → NO BREAKING')
}

// Test 3: official blog + singleton cluster → BREAKING
{
  const events = [
    makeEvent({
      id: 'nvidia-1',
      source_name: 'NVIDIA Blog',
      source: { name: 'NVIDIA Blog', url: 'https://blogs.nvidia.com/post/123' },
      metadata: { clusterSize: 1 },
    }),
  ]
  const result = breakingRule.evaluate(events)
  const nvidiaSig = result.signals.find((s) => s.metadata?.eventId === 'nvidia-1')
  assert(nvidiaSig?.subtype === 'BREAKING', 'official blog singleton → BREAKING')
}

// Test 4: model_release + score ≥ 55 → BREAKING
{
  const events = [
    makeEvent({
      id: 'model-1',
      rank: { totalScore: 60 },
      rank_total: 60,
      eventType: 'model_release',
    }),
  ]
  const result = breakingRule.evaluate(events)
  const modelSig = result.signals.find((s) => s.metadata?.eventId === 'model-1')
  assert(modelSig?.subtype === 'BREAKING', 'model_release + score 60 → BREAKING')
}

// Test 5: acquisition + low score → STILL BREAKING (score threshold removed per v2 architecture)
{
  const events = [
    makeEvent({
      id: 'acq-1',
      rank: { totalScore: 50 },
      rank_total: 50,
      eventType: 'acquisition',
    }),
  ]
  const result = breakingRule.evaluate(events)
  assert(result.signals.length === 1, 'acquisition + low score → BREAKING (unconditional)')
  assert(result.signals[0].subtype === 'BREAKING', 'acquisition → BREAKING subtype')
}

// ---- 7.2 DiversityRule Tests ----

console.log('\n=== 7.2 DiversityRule ===')

// Test 6: Category cap → DIVERSITY_CAP for excess
{
  const diversityRule = new DiversityRule()
  const events = []
  for (let i = 0; i < 10; i++) {
    events.push(makeEvent({ id: `cat-${i}`, category: 'industry', rank: { totalScore: 80 - i }, rank_total: 80 - i }))
  }
  // Build candidates manually with finalRank
  const candidates = events.map((e, i) => ({
    event: e,
    finalRank: (e.rank?.totalScore ?? e.rank_total ?? 0) - i * 0.1,
    contextHints: [],
    signals: [],
  }))
  const capSignals = diversityRule.applyCap(candidates, new Set())
  const dcapSignals = capSignals.filter((s) => s.subtype === 'DIVERSITY_CAP')
  assert(dcapSignals.length === 2, `10 candidates in 1 category → 2 DIVERSITY_CAP (expected 2, got ${dcapSignals.length})`)
}

// Test 7: BREAKING exempt from cap
{
  const diversityRule = new DiversityRule()
  const events = []
  for (let i = 0; i < 12; i++) {
    events.push(makeEvent({ id: `br-${i}`, category: 'industry', rank: { totalScore: 90 - i }, rank_total: 90 - i }))
  }
  const candidates = events.map((e, i) => ({
    event: e,
    finalRank: 90 - i * 0.1,
    contextHints: [],
    signals: [],
  }))
  const breakingIds = new Set(['br-0', 'br-1', 'br-2'])
  const capSignals = diversityRule.applyCap(candidates, breakingIds)
  // 12 total, 3 BREAKING exempt → 9 regular, cap at 8 → 1 DIVERSITY_CAP
  const dcapSignals = capSignals.filter((s) => s.subtype === 'DIVERSITY_CAP')
  assert(dcapSignals.length === 1, `BREAKING exempt: 12 candidates, 3 breaking → 1 DIVERSITY_CAP (got ${dcapSignals.length})`)
}

// ---- 7.3 EditorialMemoryRule Tests ----

console.log('\n=== 7.3 EditorialMemoryRule ===')

// Test 8: entity hit in recent history → MEMORY signal
{
  const mockStore = {
    load() {
      return {
        days: {
          '2026-07-01': { topEventIds: [], topEntities: ['OpenAI', 'Meta'], topCategories: [] },
          '2026-06-30': { topEventIds: [], topEntities: ['OpenAI'], topCategories: [] },
          '2026-06-29': { topEventIds: [], topEntities: ['OpenAI'], topCategories: [] },
        },
      }
    },
  }
  const memoryRule = new EditorialMemoryRule(mockStore)
  const events = [
    makeEvent({ id: 'mem-1', entities: ['OpenAI'] }),
  ]
  const result = memoryRule.evaluate(events, { date: '2026-07-02' })
  const memSig = result.signals.find((s) => s.subtype === 'MEMORY')
  assert(memSig?.metadata?.entity === 'OpenAI', 'entity hit → MEMORY signal')
  assert(memSig?.metadata?.recentDays === 3, `recentDays should be 3, got ${memSig?.metadata?.recentDays}`)
}

// Test 9: no memory hit → no signals
{
  const mockStore = {
    load() { return { days: {} } },
  }
  const memoryRule = new EditorialMemoryRule(mockStore)
  const events = [
    makeEvent({ id: 'mem-2', entities: ['UnknownCo'] }),
  ]
  const result = memoryRule.evaluate(events, { date: '2026-07-02' })
  assert(result.signals.length === 0, 'no hit → no MEMORY signals')
}

// ---- 7.4 CandidateBuilder Integration Tests ----

console.log('\n=== 7.4 CandidateBuilder Integration ===')

// Test 10: empty events → empty result
{
  const builder = new CandidateBuilder([new BreakingRule()])
  const result = builder.build([], { date: '2026-07-02' })
  assert(result.finalCandidates.length === 0, 'empty events → empty result')
  assert(result.filteredIn === 0, 'empty events → filteredIn = 0')
}

// Test 11: BREAKING overrides DIVERSITY_CAP
{
  // Create 10 events in same category, one with BREAKING entity
  const events = [
    makeEvent({ id: 'critical', entities: ['OpenAI'], category: 'industry', rank: { totalScore: 75 }, rank_total: 75 }),
  ]
  for (let i = 0; i < 10; i++) {
    events.push(makeEvent({ id: `reg-${i}`, entities: ['Meta'], category: 'industry', rank: { totalScore: 70 - i }, rank_total: 70 - i }))
  }

  const builder = new CandidateBuilder([
    new BreakingRule(),
    new DiversityRule(),
  ])
  const result = builder.build(events, { date: '2026-07-02' })

  // The BREAKING event (OpenAI singleton) should be in finalCandidates
  const critical = result.finalCandidates.find((c) => c.event.id === 'critical')
  assert(!!critical, 'BREAKING event preserved in finalCandidates')
}

// Test 12: boost cap at +30
{
  const log = new SignalLog()
  for (let i = 0; i < 5; i++) {
    log.add([{ phase: 'RANK', subtype: 'ENTITY_PRIORITY', weight: 10, source: 'test', reason: 'test', metadata: { eventId: 'test-ev' } }])
  }
  const boosts = ResolutionPolicy.resolveRank(log)
  assert(boosts.get('test-ev') === 30, `boost capped at +30 (got ${boosts.get('test-ev')})`)
}

// ---- 7.5 JsonEditorialMemoryStore Tests ----

console.log('\n=== 7.5 JsonEditorialMemoryStore ===')

// Test 13: load non-existent file → empty
{
  const store = new JsonEditorialMemoryStore('/tmp/nonexistent-memory-test.json')
  const result = store.load('2026-06-01')
  assert(result.days && Object.keys(result.days).length === 0, 'non-existent file → empty snapshot')
}

// Test 14: save + load roundtrip
{
  const testPath = `/tmp/editorial-memory-test-${Date.now()}.json`
  const store = new JsonEditorialMemoryStore(testPath)
  store.save('2026-07-02', {
    topEventIds: ['a', 'b'],
    topEntities: ['OpenAI'],
    topCategories: ['industry'],
  })
  const result = store.load('2026-07-01')
  assert(result.days['2026-07-02']?.topEntities?.includes('OpenAI'), 'save + load roundtrip')
}

// Test 15: prune old data
{
  const testPath2 = `/tmp/editorial-memory-prune-${Date.now()}.json`
  const store = new JsonEditorialMemoryStore(testPath2)
  store.save('2026-06-25', { topEventIds: [], topEntities: [], topCategories: [] })
  store.save('2026-07-02', { topEventIds: [], topEntities: [], topCategories: [] })
  store.prune('2026-06-30')
  const result = store.load('2026-06-01')
  assert(!result.days['2026-06-25'], 'old data pruned')
  assert(result.days['2026-07-02'], 'recent data preserved')
}

// ---- Summary ----
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
process.exit(failed > 0 ? 1 : 0)
