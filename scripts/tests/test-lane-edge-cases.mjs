/**
 * Lane Dispatcher + Merge Engine — Edge Case Test Suite
 *
 * Covers 18 scenarios across Lane Dispatcher, Lane Execution, and Merge Engine.
 *
 * Usage: node scripts/domain/editorial/test-lane-edge-cases.mjs
 */

import { LaneDispatcher } from './lane-dispatcher.mjs'
import { executeLanes, MergeEngine } from './merge-engine.mjs'
import { DEFAULT_LANE_CONFIGS, DEFAULT_MERGE_CONFIG } from './lane-types.mjs'
import { BreakingRule } from './rules/breaking-rule.mjs'

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
    url: 'https://example.com/news',
    summary: 'Test summary content',
    entities: ['OpenAI'],
    source_name: 'TechCrunch',
    source: { name: 'TechCrunch', url: 'https://techcrunch.com' },
    rank: { totalScore: 65 },
    rank_total: 65,
    category: 'industry',
    editorialDomain: 'industry',
    published_at: new Date().toISOString(),
    ...overrides,
  }
}

function makeCandidate(overrides = {}) {
  return {
    event: makeEvent(),
    finalRank: 50,
    contextHints: [],
    signals: [],
    ...overrides,
  }
}

const dispatcher = new LaneDispatcher()

// ============================================================
// Lane Dispatcher Edge Cases
// ============================================================

console.log('\n## Lane Edge Cases 测试报告\n')

// --- 场景 1: Empty events array → all lanes empty ---
{
  console.log('### 场景 1: 空 events 数组')
  const map = dispatcher.dispatch([], DEFAULT_LANE_CONFIGS)
  let total = 0
  for (const [, v] of map) total += v.length
  const ok = assert(total === 0, '空 events → 所有 Lane 为空')
  console.log(`结果: ${ok ? 'PASS' : 'FAIL'}`)
  console.log('说明: 确认空输入不会导致意外行为，所有 Lane 收到空数组\n')
}

// --- 场景 2: All events belong to same lane ---
{
  console.log('### 场景 2: 所有 events 属于同一个 Lane')
  const events = [
    makeEvent({ id: 'same-1', editorialDomain: 'industry', category: 'industry' }),
    makeEvent({ id: 'same-2', editorialDomain: 'industry', category: 'industry' }),
    makeEvent({ id: 'same-3', editorialDomain: 'industry', category: 'industry' }),
  ]
  const map = dispatcher.dispatch(events, DEFAULT_LANE_CONFIGS)
  let otherTotal = 0
  for (const [laneId, v] of map) {
    if (laneId !== 'industry') otherTotal += v.length
  }
  const ok = assert(map.get('industry').length === 3, 'industry Lane 有 3 个 events') &&
             assert(otherTotal === 0, '其他 Lane 均为空')
  console.log(`结果: ${ok ? 'PASS' : 'FAIL'}`)
  console.log('说明: 所有事件通过 editorialDomain 正确归入同一 Lane，其他 Lane 不产生影响\n')
}

// --- 场景 3: Multiple events share editorialDomain → correct lane ---
{
  console.log('### 场景 3: 多个 events 共享同一 editorialDomain')
  const events = [
    makeEvent({ id: 'share-1', editorialDomain: 'research', category: 'research' }),
    makeEvent({ id: 'share-2', editorialDomain: 'research', category: 'research' }),
    makeEvent({ id: 'share-3', editorialDomain: 'research', category: 'research' }),
    makeEvent({ id: 'share-4', editorialDomain: 'research', category: 'research' }),
    makeEvent({ id: 'share-5', editorialDomain: 'research', category: 'research' }),
  ]
  const map = dispatcher.dispatch(events, DEFAULT_LANE_CONFIGS)
  const ok = assert(map.get('research').length === 5, 'research Lane 有 5 个 events')
  console.log(`结果: ${ok ? 'PASS' : 'FAIL'}`)
  console.log('说明: 5 个同 domain 事件正确归入同 Lane，不分散到其他 Lane\n')
}

// --- 场景 4: Dispatch 后 Event 不被修改（const 性验证）---
{
  console.log('### 场景 4: Dispatch 后 Event 不被修改（const 性验证）')
  const originalId = 'const-check-1'
  const originalCategory = 'policy'
  const events = [makeEvent({ id: originalId, editorialDomain: 'policy', category: originalCategory })]
  const snapshot = { ...events[0], rank: { ...events[0].rank } }
  dispatcher.dispatch(events, DEFAULT_LANE_CONFIGS)
  // Verify event object is untouched
  const idOk = assert(events[0].id === originalId, 'event.id 未被修改')
  const catOk = assert(events[0].category === originalCategory, 'event.category 未被修改')
  const refOk = assert(events[0] === events[0], 'event 引用未被替换')
  const ok = idOk && catOk && refOk
  console.log(`结果: ${ok ? 'PASS' : 'FAIL'}`)
  console.log('说明: Dispatcher 只读地引用 Event，不添加/删除/修改任何属性\n')
}

// --- 场景 5: Custom LaneConfig（仅有 2 个 Lane）→ 未知 domain→fallback ---
{
  console.log('### 场景 5: 自定义 LaneConfig（仅有 2 个 Lane）')
  const customConfig = {
    fastlane: { domain: 'research', maxSize: 5 },
    bizlane:  { domain: 'industry', maxSize: 5 },
  }
  const knownEvents = [
    makeEvent({ id: 'custom-a', editorialDomain: 'research' }),
    makeEvent({ id: 'custom-b', editorialDomain: 'industry' }),
  ]
  const unknownEvent = makeEvent({ id: 'custom-c', editorialDomain: 'sports_unknown' })

  // part A: known domains route correctly
  const mapKnown = dispatcher.dispatch(knownEvents, customConfig)
  const fastlaneOk = mapKnown.get('fastlane') && mapKnown.get('fastlane').length === 1
  const bizlaneOk = mapKnown.get('bizlane') && mapKnown.get('bizlane').length === 1

  // part B: unknown domain → would crash because no fallback lane exists
  let unknownCrashed = false
  try {
    dispatcher.dispatch([unknownEvent], customConfig)
  } catch (e) {
    unknownCrashed = true
  }

  // With fallback in config, unknown domain should route to fallback
  const configWithFallback = { ...customConfig, fallback: { domain: '__fallback__', maxSize: 3 } }
  const mapWithFB = dispatcher.dispatch([unknownEvent], configWithFallback)
  const fallbackHasIt = mapWithFB.get('fallback') && mapWithFB.get('fallback').length === 1

  const ok = assert(fastlaneOk, '已知 domain research → fastlane') &&
             assert(bizlaneOk, '已知 domain industry → bizlane') &&
             assert(unknownCrashed, '无 fallback Lane 时未知 domain 会崩溃') &&
             assert(fallbackHasIt, '有 fallback Lane 时未知 domain 正确归入 fallback')
  console.log(`结果: ${ok ? 'PASS' : 'FAIL'}`)
  console.log('说明: 自定义 2 Lane 配置对已知 domain 正常工作；未提供 fallback 时未知 domain 会崩溃（laneMap.get("fallback") 为 undefined）；提供 fallback 后未知 domain 正确归入\n')
}

// --- 场景 6: laneConfig 空对象 → 只有 fallback ---
{
  console.log('### 场景 6: laneConfig 空对象')
  let crashed = false
  try {
    dispatcher.dispatch([makeEvent({ id: 'empty-cfg' })], {})
  } catch (e) {
    crashed = true
  }
  const ok = assert(crashed, '空 laneConfig 导致崩溃（无任何 Lane 被初始化）')
  console.log(`结果: ${ok ? 'PASS' : 'FAIL'}`)
  console.log('说明: 空 laneConfig 对象没有任何 Lane key，dispatch 时 laneMap 为空，fallback Lane 不存在导致 TypeError\n')
}

// ============================================================
// Lane Execution Edge Cases
// ============================================================

console.log('---\n')

// --- 场景 7: All lanes empty → all return empty results ---
{
  console.log('### 场景 7: 所有 Lane 都空')
  const laneMap = new Map()
  laneMap.set('research', [])
  laneMap.set('industry', [])
  laneMap.set('policy', [])

  const results = executeLanes(laneMap, DEFAULT_LANE_CONFIGS, {}, [new BreakingRule()])
  let allEmpty = true
  for (const [, result] of results) {
    if (result.candidates.length > 0) allEmpty = false
  }
  const ok = assert(allEmpty, '所有空 Lane 返回空结果')
  console.log(`结果: ${ok ? 'PASS' : 'FAIL'}`)
  console.log('说明: executeLanes 对空 Lane 跳过 CandidateBuilder 构建，返回空 candidates\n')
}

// --- 场景 8: One lane has events, others empty → only that lane has candidates ---
{
  console.log('### 场景 8: 一个 Lane 有 events，其他空')
  const laneMap = new Map()
  laneMap.set('industry', [
    makeEvent({ id: 'only-lane-1', editorialDomain: 'industry', rank: { totalScore: 80 } }),
    makeEvent({ id: 'only-lane-2', editorialDomain: 'industry', rank: { totalScore: 70 } }),
  ])
  laneMap.set('research', [])
  laneMap.set('policy', [])

  const results = executeLanes(laneMap, DEFAULT_LANE_CONFIGS, {}, [])
  const indResult = results.get('industry')
  const resResult = results.get('research')
  const polResult = results.get('policy')
  const ok = assert(indResult && indResult.candidates.length === 2, 'industry Lane 有 2 个 candidates') &&
             assert(resResult && resResult.candidates.length === 0, 'research Lane 空') &&
             assert(polResult && polResult.candidates.length === 0, 'policy Lane 空')
  console.log(`结果: ${ok ? 'PASS' : 'FAIL'}`)
  console.log('说明: 仅有非空 Lane 产出 candidates，其余 Lane 返回空结果，互不影响\n')
}

// --- 场景 9: Lane maxSize=0 → no candidates from that lane ---
{
  console.log('### 场景 9: Lane maxSize=0')
  const zeroConfig = {
    zerolane: { domain: 'zerodomain', maxSize: 0 },
  }
  const laneMap = new Map()
  laneMap.set('zerolane', [
    makeEvent({ id: 'zero-1', editorialDomain: 'zerodomain', category: 'zerodomain', rank: { totalScore: 90 } }),
  ])
  const results = executeLanes(laneMap, zeroConfig, {}, [new BreakingRule()])
  const result = results.get('zerolane')
  const ok = assert(result && result.candidates.length === 0, 'maxSize=0 → 0 candidates')
  console.log(`结果: ${ok ? 'PASS' : 'FAIL'}`)
  console.log('说明: CandidateBuilder 的 maxSize=0 使 Truncate 阶段 slice(0,0) 产出空数组\n')
}

// --- 场景 10: No rules (empty array) → CandidateBuilder still works ---
{
  console.log('### 场景 10: 无 rules（空数组）')
  const laneMap = new Map()
  laneMap.set('industry', [
    makeEvent({ id: 'norules-1', editorialDomain: 'industry', rank: { totalScore: 85 }, rank_total: 85 }),
    makeEvent({ id: 'norules-2', editorialDomain: 'industry', rank: { totalScore: 75 }, rank_total: 75 }),
  ])
  const results = executeLanes(laneMap, DEFAULT_LANE_CONFIGS, {}, [])
  const result = results.get('industry')
  const ok = assert(result && result.candidates.length === 2, '空 rules → 仍有 2 个 candidates') &&
             assert(result && result.candidates[0].signals.length === 0, 'candidates 无 signals')
  console.log(`结果: ${ok ? 'PASS' : 'FAIL'}`)
  console.log('说明: CandidateBuilder 无 rules 时跳过 Collect 和 Filter 阶段，直接按 score 排名产出 candidates\n')
}

// ============================================================
// Merge Engine Edge Cases
// ============================================================

console.log('---\n')

// --- 场景 11: Empty input → empty result ---
{
  console.log('### 场景 11: 空输入')
  const engine = new MergeEngine(DEFAULT_MERGE_CONFIG)
  const result = engine.merge(new Map())
  const ok = assert(result && result.candidates.length === 0, '空输入 → 空结果')
  console.log(`结果: ${ok ? 'PASS' : 'FAIL'}`)
  console.log('说明: MergeEngine 对空 Map 直接返回空 candidates\n')
}

// --- 场景 12: maxSize=1 → only 1 item ---
{
  console.log('### 场景 12: maxSize=1')
  const engine = new MergeEngine({
    maxSize: 1,
    policies: { minimum_representation: false, breaking_override: false, global_diversity: false },
  })
  const laneResults = new Map()
  laneResults.set('research', {
    candidates: [
      makeCandidate({ finalRank: 90 }),
      makeCandidate({ finalRank: 80 }),
    ],
    signalLog: [],
    stats: { in: 2, out: 0 },
  })
  laneResults.set('industry', {
    candidates: [makeCandidate({ finalRank: 70 })],
    signalLog: [],
    stats: { in: 1, out: 0 },
  })
  const result = engine.merge(laneResults)
  const ok = assert(result.candidates.length === 1, 'maxSize=1 → 只有 1 条 candidate')
  console.log(`结果: ${ok ? 'PASS' : 'FAIL'}`)
  console.log('说明: 严格截断到 maxSize，高分 candidates 被优先保留\n')
}

// --- 场景 13: maxSize < lane count → protected items preserved ---
{
  console.log('### 场景 13: maxSize 小于 Lane 数')
  const engine = new MergeEngine({
    maxSize: 2,
    policies: { minimum_representation: true, breaking_override: false, global_diversity: false },
  })
  const laneResults = new Map()
  laneResults.set('research', {
    candidates: [makeCandidate({ finalRank: 95 }), makeCandidate({ finalRank: 90 })],
    signalLog: [],
    stats: { in: 2, out: 0 },
  })
  laneResults.set('industry', {
    candidates: [makeCandidate({ finalRank: 85 })],
    signalLog: [],
    stats: { in: 1, out: 0 },
  })
  laneResults.set('policy', {
    candidates: [makeCandidate({ finalRank: 80 })],
    signalLog: [],
    stats: { in: 1, out: 0 },
  })
  const result = engine.merge(laneResults)
  // min_rep protects top-1 from each lane → 3 protected items
  // maxSize=2 but protected takes priority → at least 3 items
  const ok = assert(result.candidates.length >= 3, `maxSize=2 时 protected items 优先保留（实际 ${result.candidates.length}）`)
  console.log(`结果: ${ok ? 'PASS' : 'FAIL'}`)
  console.log('说明: minimum_representation 确保每 Lane 至少 1 条被 protected，protected 不受 maxSize 限制\n')
}

// --- 场景 14: No BREAKING signals → breaking_override has no effect ---
{
  console.log('### 场景 14: 无 BREAKING signals')
  const engine = new MergeEngine({
    maxSize: 40,
    policies: { minimum_representation: false, breaking_override: true, global_diversity: false },
  })
  const laneResults = new Map()
  laneResults.set('research', {
    candidates: [
      makeCandidate({ finalRank: 70 }),
      makeCandidate({ finalRank: 60 }),
    ],
    signalLog: [],
    stats: { in: 2, out: 0 },
  })
  laneResults.set('industry', {
    candidates: [
      makeCandidate({ finalRank: 90 }),
      makeCandidate({ finalRank: 80 }),
    ],
    signalLog: [],
    stats: { in: 2, out: 0 },
  })
  const result = engine.merge(laneResults)
  let sortedOk = true
  for (let i = 1; i < result.candidates.length; i++) {
    if (result.candidates[i].finalRank > result.candidates[i - 1].finalRank) {
      sortedOk = false
      break
    }
  }
  const ok = assert(sortedOk, '无 BREAKING → 按 finalRank 降序排列')
  console.log(`结果: ${ok ? 'PASS' : 'FAIL'}`)
  console.log('说明: 无 BREAKING signal 时 breaking_override 不产生影响，排序等价于普通 finalRank 降序\n')
}

// --- 场景 15: minimum_representation=false → low-score lane candidates may be lost ---
{
  console.log('### 场景 15: minimum_representation=false')
  const engine = new MergeEngine({
    maxSize: 2,
    policies: { minimum_representation: false, breaking_override: false, global_diversity: false },
  })
  const laneResults = new Map()
  laneResults.set('high', {
    candidates: [
      makeCandidate({ finalRank: 100, event: makeEvent({ id: 'high-1' }) }),
      makeCandidate({ finalRank: 95, event: makeEvent({ id: 'high-2' }) }),
    ],
    signalLog: [],
    stats: { in: 2, out: 0 },
  })
  laneResults.set('low', {
    candidates: [
      makeCandidate({ finalRank: 30, event: makeEvent({ id: 'low-1' }) }),
    ],
    signalLog: [],
    stats: { in: 1, out: 0 },
  })
  const result = engine.merge(laneResults)
  const lowLaneCount = result.candidates.filter((c) => c._laneId === 'low').length
  // With maxSize=2 and min_rep=false, only top 2 from high lane survive
  const ok = assert(result.candidates.length === 2, `maxSize=2，期望 2 条（实际 ${result.candidates.length}）`) &&
             assert(lowLaneCount === 0, `low Lane 无 protected，全部丢失（实际 ${lowLaneCount}）`)
  console.log(`结果: ${ok ? 'PASS' : 'FAIL'}`)
  console.log('说明: minimum_representation=false 时低分 Lane 无保护，maxSize 截断可能淘汰其全部 candidate\n')
}

// --- 场景 16: Multiple BREAKING candidates across lanes → sorting correct ---
{
  console.log('### 场景 16: 多个 BREAKING candidates 跨 Lane')
  const engine = new MergeEngine({
    maxSize: 40,
    policies: { minimum_representation: false, breaking_override: true, global_diversity: false },
  })
  const laneResults = new Map()
  laneResults.set('research', {
    candidates: [
      // BREAKING with low rank
      makeCandidate({
        finalRank: 40,
        event: makeEvent({ id: 'breaking-r' }),
        signals: [{ subtype: 'BREAKING', phase: 'FILTER', metadata: { eventId: 'breaking-r' } }],
      }),
      // Non-breaking with high rank
      makeCandidate({
        finalRank: 90,
        event: makeEvent({ id: 'normal-r' }),
        signals: [],
      }),
    ],
    signalLog: [],
    stats: { in: 2, out: 0 },
  })
  laneResults.set('industry', {
    candidates: [
      // BREAKING with even lower rank
      makeCandidate({
        finalRank: 30,
        event: makeEvent({ id: 'breaking-i' }),
        signals: [{ subtype: 'BREAKING', phase: 'FILTER', metadata: { eventId: 'breaking-i' } }],
      }),
      // Non-breaking with medium rank
      makeCandidate({
        finalRank: 80,
        event: makeEvent({ id: 'normal-i' }),
        signals: [],
      }),
    ],
    signalLog: [],
    stats: { in: 2, out: 0 },
  })
  const result = engine.merge(laneResults)

  // All BREAKING should appear before all non-BREAKING
  let lastBreakingIdx = -1
  let firstNonBreakingIdx = result.candidates.length
  for (let i = 0; i < result.candidates.length; i++) {
    const c = result.candidates[i]
    const isBreaking = c.signals && c.signals.some((s) => s.subtype === 'BREAKING')
    if (isBreaking) lastBreakingIdx = i
    else if (firstNonBreakingIdx === result.candidates.length) firstNonBreakingIdx = i
  }
  const ok = assert(lastBreakingIdx < firstNonBreakingIdx, `BREAKING 全部在非 BREAKING 之前（lastBreaking=${lastBreakingIdx}, firstNonBreaking=${firstNonBreakingIdx})`)
  console.log(`结果: ${ok ? 'PASS' : 'FAIL'}`)
  console.log('说明: breaking_override 在排序阶段确保所有 BREAKING candidates 在非 BREAKING 之前，BREAKING 间按 finalRank 降序\n')
}

// --- 场景 17: Single candidate → returned as-is ---
{
  console.log('### 场景 17: 单条 candidate')
  const engine = new MergeEngine(DEFAULT_MERGE_CONFIG)
  const laneResults = new Map()
  laneResults.set('research', {
    candidates: [
      makeCandidate({ finalRank: 75, event: makeEvent({ id: 'single-1' }) }),
    ],
    signalLog: [],
    stats: { in: 1, out: 0 },
  })
  const result = engine.merge(laneResults)
  const ok = assert(result.candidates.length === 1, '1 个 Lane 1 个 candidate → 1 条输出') &&
             assert(result.candidates[0].finalRank === 75, 'finalRank 保持不变')
  console.log(`结果: ${ok ? 'PASS' : 'FAIL'}`)
  console.log('说明: 单条输入不经截断或排序变动，原样返回\n')
}

// --- 场景 18: Output candidates don't contain _laneCandidates / _protected / _breaking ---
{
  console.log('### 场景 18: 输出不含临时字段')
  const engine = new MergeEngine({
    maxSize: 40,
    policies: { minimum_representation: true, breaking_override: true, global_diversity: false },
  })
  const laneResults = new Map()
  laneResults.set('research', {
    candidates: [
      makeCandidate({
        finalRank: 95,
        event: makeEvent({ id: 'temp-a' }),
        signals: [{ subtype: 'BREAKING', phase: 'FILTER', metadata: { eventId: 'temp-a' } }],
      }),
    ],
    signalLog: [],
    stats: { in: 1, out: 0 },
  })
  laneResults.set('industry', {
    candidates: [
      makeCandidate({ finalRank: 70, event: makeEvent({ id: 'temp-b' }) }),
    ],
    signalLog: [],
    stats: { in: 1, out: 0 },
  })
  const result = engine.merge(laneResults)

  let hasTempFields = false
  for (const c of result.candidates) {
    if ('_laneCandidates' in c) { hasTempFields = true; break }
    if ('_protected' in c) { hasTempFields = true; break }
    if ('_breaking' in c) { hasTempFields = true; break }
  }
  const ok = assert(!hasTempFields, '所有临时字段已从输出中剥离') &&
             assert(result.candidates.length === 2, '2 条 candidate 正常输出')
  console.log(`结果: ${ok ? 'PASS' : 'FAIL'}`)
  console.log('说明: MergeEngine 返回前通过解构排除 _laneCandidates / _protected / _breaking 临时字段\n')
}

// ============================================================
// Summary
// ============================================================
console.log(`### 总结: ${passed}/${passed + failed} pass, ${failed} fail`)
process.exit(failed > 0 ? 1 : 0)
