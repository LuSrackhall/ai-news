/**
 * Candidate Builder — Edge Case Test Suite
 *
 * Covers boundary conditions, error resilience, and degenerate inputs.
 *
 * Usage: node scripts/domain/editorial/test-edge-cases.mjs
 */

import { BreakingRule } from './rules/breaking-rule.mjs'
import { DiversityRule } from './rules/diversity-rule.mjs'
import { EditorialMemoryRule } from './rules/memory-rule.mjs'
import { CandidateBuilder } from './candidate-builder.mjs'
import { JsonEditorialMemoryStore } from '../../services/editorial-memory-store.mjs'
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

let passed = 0
let failed = 0

function assert(condition, label) {
  if (condition) { passed++; return true }
  console.error(`  FAIL: ${label}`)
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
// Edge Case Tests
// ============================================================

console.log('\n=== Edge Cases ===\n')

// --- EC1: Empty events list ---
{
  const builder = new CandidateBuilder([new BreakingRule(), new DiversityRule()])
  const result = builder.build([], { date: '2026-07-02' })
  assert(result.finalCandidates.length === 0, 'EC1a: empty events → empty finalCandidates')
  assert(result.filteredIn === 0, 'EC1b: empty events → filteredIn = 0')
  assert(result.filteredOut === 0, 'EC1c: empty events → filteredOut = 0')
  assert(result.signalLog.length === 0, 'EC1d: empty events → empty signalLog')
  assert(result.rankedCandidates.length === 0, 'EC1e: empty events → empty rankedCandidates')
  console.log('### 场景: 空 events 列表')
  console.log('结果: ' + (result.finalCandidates.length === 0 ? 'PASS' : 'FAIL'))
  console.log('说明: 确认管道在所有阶段正确处理空输入，不产生异常或假候选')
}

// --- EC2: Rule throws exception ---
{
  class CrasherRule {
    evaluate() { throw new Error('Intentional crash') }
  }
  const builder = new CandidateBuilder([new CrasherRule(), new BreakingRule()])
  const events = [makeEvent({ entities: ['OpenAI'], rank: { totalScore: 80 } })]
  let crashed = false
  try {
    const result = builder.build(events, { date: '2026-07-02' })
    // Should succeed — CrasherRule is caught in Phase 0
    assert(result.signalLog.length >= 0, 'EC2: builder did not crash despite failing rule')
  } catch (e) {
    crashed = true
    console.error('  FAIL: EC2 builder crashed:', e.message)
    failed++
  }
  assert(!crashed, 'EC2: builder must not crash when a rule throws')
  console.log('### 场景: Rule 抛异常')
  console.log('结果: ' + (!crashed ? 'PASS' : 'FAIL'))
  console.log('说明: 验证 CandidateBuilder 对单个 Rule 异常的容错，确保 build() 不会因为某个 Rule 失败而整体崩溃')
}

// --- EC3: Events with null/undefined fields ---
{
  const events = [
    { id: 'null-1' },                                              // minimal
    { id: 'null-2', entities: null, rank: null },                  // null fields
    { id: 'null-3', entities: undefined, rank: undefined },        // undefined fields
    { id: 'null-4', category: undefined, source_name: null, source: null }, // missing nested
    { id: 'null-5', entities: ['OpenAI'], rank: { totalScore: 80 }, category: 'industry' }, // valid
    { id: 'null-7', rank: { totalScore: null }, entities: [null] },        // null inside objects
  ]
  const builder = new CandidateBuilder([new BreakingRule(), new DiversityRule()])
  let crashed = false
  try {
    const result = builder.build(events, { date: '2026-07-02' })
    assert(Array.isArray(result.finalCandidates), 'EC3: result has finalCandidates array')
    // Should not crash; valid event should be processed
    assert(typeof result.filteredIn === 'number', 'EC3: filteredIn is a number')
  } catch (e) {
    crashed = true
    console.error('  FAIL: EC3 crashed:', e.message)
    failed++
  }
  assert(!crashed, 'EC3: must not crash on events with null/undefined fields')
  console.log('### 场景: events 包含 null/undefined 字段')
  console.log('结果: ' + (!crashed ? 'PASS' : 'FAIL'))
  console.log('说明: 确认管道对残缺/非法 event 对象的健壮性，空值不应导致属性读取异常')
}

// --- EC4: All events HOLD (non-BREAKING, all capped) ---
{
  // Create a store that emits MEMORY signal for one event, then cap it
  const events = []
  for (let i = 0; i < 10; i++) {
    events.push(makeEvent({
      id: `holdable-${i}`,
      category: 'industry',
      rank: { totalScore: 60 - i },
      rank_total: 60 - i,
    }))
  }
  const builder = new CandidateBuilder([new DiversityRule()])
  const result = builder.build(events, { date: '2026-07-02' })
  // DiversityRule applies applyCap in Phase 2: cap at 8 per category
  assert(result.finalCandidates.length <= 8, `EC4: at most 8 candidates after cap (got ${result.finalCandidates.length})`)
  console.log('### 场景: 所有 event 被 HOLD（非 BREAKING 且超类别上限）')
  console.log('结果: ' + (result.finalCandidates.length <= 8 ? 'PASS' : 'FAIL'))
  console.log('说明: 验证类别上限截断不产生异常，队列正确处理 HOLD 标记清除')
}

// --- EC5: maxSize=1 ---
{
  const events = [
    makeEvent({ id: 'a1', rank: { totalScore: 90 }, rank_total: 90 }),
    makeEvent({ id: 'a2', rank: { totalScore: 80 }, rank_total: 80 }),
    makeEvent({ id: 'a3', rank: { totalScore: 70 }, rank_total: 70 }),
  ]
  const builder = new CandidateBuilder([new BreakingRule()], { maxSize: 1 })
  const result = builder.build(events, { date: '2026-07-02' })
  assert(result.finalCandidates.length === 1, `EC5: maxSize=1 → exactly 1 candidate (got ${result.finalCandidates.length})`)
  assert(result.finalCandidates[0].event.id === 'a1', 'EC5: top-ranked candidate returned')
  console.log('### 场景: maxSize=1')
  console.log('结果: ' + (result.finalCandidates.length === 1 ? 'PASS' : 'FAIL'))
  console.log('说明: 确认 maxSize 参数在截断阶段的正确性')
}

// --- EC6: Event has no entities property → BreakingRule handles ---
{
  const events = [
    { id: 'no-ents-1', rank: { totalScore: 80 }, source: { name: 'TechCrunch', url: 'https://techcrunch.com' }, source_name: 'TechCrunch', category: 'industry' },
    { id: 'no-ents-2', rank: { totalScore: 70 }, source: { name: 'TechCrunch', url: 'https://techcrunch.com' }, source_name: 'TechCrunch', category: 'industry' },
  ]
  const rule = new BreakingRule()
  let crashed = false
  try {
    const result = rule.evaluate(events)
    assert(Array.isArray(result.signals), 'EC6: signals is array')
    // Top_tier check: no entities[] → hasTopTierEntity returns null → skip condition 1
    // Ensure no crash
    assert(result.signals.length === 0, 'EC6: no entities → no breaking')
  } catch (e) {
    crashed = true
    console.error('  FAIL: EC6 crashed:', e.message)
    failed++
  }
  assert(!crashed, 'EC6: BreakingRule must not crash on events without entities')
  console.log('### 场景: event 没有 entities 属性')
  console.log('结果: ' + (!crashed ? 'PASS' : 'FAIL'))
  console.log('说明: BreakingRule 内部访问 event.entities 前未检查，但通过默认值缺省保护')
}

// --- EC7: Memory-store corrupted JSON file → load() degrades ---
{
  const testPath = `/tmp/editorial-memory-corrupt-${Date.now()}.json`
  // Write corrupted JSON
  writeFileSync(testPath, 'not valid json {{{', 'utf-8')
  const store = new JsonEditorialMemoryStore(testPath)
  let crashed = false
  let result
  try {
    result = store.load('2026-07-01')
  } catch (e) {
    crashed = true
    console.error('  FAIL: EC7 crashed:', e.message)
    failed++
  }
  assert(!crashed, 'EC7: load must not crash on corrupted file')
  assert(result && typeof result.days === 'object', 'EC7: returns { days: {} } on corruption')
  // save() should also overwrite corrupted file
  try {
    store.save('2026-07-02', { topEventIds: ['a'], topEntities: ['OpenAI'], topCategories: ['industry'] })
    const reloaded = store.load('2026-07-01')
    assert(reloaded.days['2026-07-02']?.topEntities?.includes('OpenAI'), 'EC7: save+load works after corruption')
  } catch (e) {
    crashed = true
    console.error('  FAIL: EC7 save after corruption crashed:', e.message)
    failed++
  }
  assert(!crashed, 'EC7: save must not crash after corrupted file')
  // cleanup
  if (existsSync(testPath)) unlinkSync(testPath)
  console.log('### 场景: memory-store JSON 文件损坏')
  console.log('结果: ' + (!crashed ? 'PASS' : 'FAIL'))
  console.log('说明: 验证 JsonEditorialMemoryStore.load/save 对文件损坏的降级行为')
}

// --- EC8: diversity-rule applyCap on empty list → empty signals ---
{
  const rule = new DiversityRule()
  let crashed = false
  let signals
  try {
    signals = rule.applyCap([], new Set())
    assert(Array.isArray(signals), 'EC8: signals is array')
    assert(signals.length === 0, 'EC8: empty candidates → 0 cap signals')
  } catch (e) {
    crashed = true
    console.error('  FAIL: EC8 crashed:', e.message)
    failed++
  }
  assert(!crashed, 'EC8: applyCap must not crash on empty list')
  console.log('### 场景: diversity-rule 的 applyCap 在空列表上')
  console.log('结果: ' + (!crashed ? 'PASS' : 'FAIL'))
  console.log('说明: applyCap 内部有 Map 遍历，空列表不应导致异常')
}

// --- EC9: Very large events (100 events) → normal truncation ---
{
  const events = []
  for (let i = 0; i < 100; i++) {
    events.push(makeEvent({
      id: `large-${i}`,
      category: i % 3 === 0 ? 'industry' : i % 3 === 1 ? 'research' : 'policy',
      rank: { totalScore: 90 - Math.floor(i / 10) },
      rank_total: 90 - Math.floor(i / 10),
      entities: ['OpenAI', 'Meta'],
    }))
  }
  const builder = new CandidateBuilder([new BreakingRule(), new DiversityRule()])
  let crashed = false
  let result
  try {
    result = builder.build(events, { date: '2026-07-02' })
  } catch (e) {
    crashed = true
    console.error('  FAIL: EC9 crashed:', e.message)
    failed++
  }
  assert(!crashed, 'EC9: must not crash with 100 events')
  assert(result.finalCandidates.length <= 40, `EC9: at most 40 final candidates (got ${result.finalCandidates.length})`)
  assert(result.rankedCandidates.length >= result.finalCandidates.length, 'EC9: ranked >= final')
  console.log('### 场景: 超大量 events（100 条）')
  console.log('结果: ' + (!crashed ? 'PASS' : 'FAIL'))
  console.log('说明: 验证大输入性能及默认 maxSize=40 截断的正确性')
}

// --- EC10: Same entity across different categories → BreakingRule correctly judges ---
{
  const events = [
    makeEvent({ id: 'inter1', entities: ['OpenAI'], category: 'industry', rank: { totalScore: 80 } }),
    makeEvent({ id: 'inter2', entities: ['OpenAI'], category: 'research', rank: { totalScore: 75 } }),
    makeEvent({ id: 'inter3', entities: ['OpenAI'], category: 'policy', rank: { totalScore: 70 } }),
  ]
  const rule = new BreakingRule()
  let crashed = false
  let result
  try {
    result = rule.evaluate(events)
    // OpenAI appears 3 times across categories → not singleton → no BREAKING
    const openaiSig = result.signals.find((s) => s.metadata?.entity === 'OpenAI')
    assert(!openaiSig, 'EC10: OpenAI across 3 categories → count=3 → NO BREAKING')
  } catch (e) {
    crashed = true
    console.error('  FAIL: EC10 crashed:', e.message)
    failed++
  }
  assert(!crashed, 'EC10: must not crash with same entity in different categories')
  console.log('### 场景: 同一个 entity 在不同 category')
  console.log('结果: ' + (!crashed && !result.signals.find(s => s.metadata?.entity === 'OpenAI') ? 'PASS' : 'FAIL'))
  console.log('说明: BreakingRule 按实体全局计数而非按 category 分组——跨 category 的同一实体合并计数')
}

// ============================================================
// EditorialMemoryStore Concurrency / Serial Resilience
// ============================================================

console.log('\n=== EditorialMemoryStore Resilience ===\n')

{
  const testPath = `/tmp/editorial-memory-concurrency-${Date.now()}.json`
  const store = new JsonEditorialMemoryStore(testPath)
  let crashed = false

  try {
    // Serial save/load/prune calls (simulating concurrent workload)
    store.save('2026-07-01', { topEventIds: ['a'], topEntities: ['OpenAI'], topCategories: ['industry'] })
    store.save('2026-07-02', { topEventIds: ['b'], topEntities: ['Meta'], topCategories: ['research'] })
    store.save('2026-07-03', { topEventIds: ['c'], topEntities: ['Anthropic'], topCategories: ['policy'] })

    // Interleaved loads
    const r1 = store.load('2026-07-02')
    assert(r1.days['2026-07-02']?.topEntities?.includes('Meta'), 'MS1: load after first saves')
    assert(!r1.days['2026-07-01'], 'MS2: load since filters before date')

    const r2 = store.load('2026-06-30')
    assert(r2.days['2026-07-01']?.topEventIds?.includes('a'), 'MS3: load since 06-30 includes all')
    assert(r2.days['2026-07-02']?.topEventIds?.includes('b'), 'MS4: load since 06-30 includes mid')
    assert(r2.days['2026-07-03']?.topEventIds?.includes('c'), 'MS5: load since 06-30 includes latest')

    // Prune middle → keeps newer, removes older
    store.prune('2026-07-01')
    const r3 = store.load('2026-06-01')
    assert(!r3.days['2026-07-01'], 'MS6: prune removes 07-01')
    assert(r3.days['2026-07-02'], 'MS7: prune keeps 07-02')
    assert(r3.days['2026-07-03'], 'MS8: prune keeps 07-03')

    // Save after prune
    store.save('2026-07-04', { topEventIds: ['d'], topEntities: ['DeepMind'], topCategories: ['industry'] })
    const r4 = store.load('2026-07-01')
    assert(r4.days['2026-07-04']?.topEntities?.includes('DeepMind'), 'MS9: save works after prune')

    // Rapid sequential saves + loads
    for (let i = 0; i < 10; i++) {
      store.save(`2026-07-${10 + i}`, { topEventIds: [`evt-${i}`], topEntities: [], topCategories: [] })
    }
    const r5 = store.load('2026-07-09')
    // 07-02, 07-03, 07-10..07-19 preserved (prune kept >= 07-02)
    const remainingDays = Object.keys(r5.days).sort()
    assert(remainingDays.length >= 10, `MS10: at least 10 days after rapid saves (got ${remainingDays.length})`)

  } catch (e) {
    crashed = true
    console.error('  FAIL: MemoryStore resilience suite crashed:', e.message)
    failed++
  }
  assert(!crashed, 'MS: editorial memory store serial resilience OK')

  // cleanup
  if (existsSync(testPath)) unlinkSync(testPath)
  console.log('### 场景: JsonEditorialMemoryStore 并发安全（串行调用 save/load/prune 多次）')
  console.log('结果: ' + (!crashed ? 'PASS' : 'FAIL'))
  console.log('说明: 验证 save/load/prune 的多次串行调用的正确性与文件一致性')
}

// ============================================================
// Summary
// ============================================================
console.log(`\n=== Edge Case Results: ${passed} passed, ${failed} failed ===`)
process.exit(failed > 0 ? 1 : 0)
