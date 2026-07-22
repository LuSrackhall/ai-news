/**
 * Lane System — 真实数据回放测试
 *
 * 用 SQLite 中的真实 Events 运行完整 Lane Dispatch + Execution + Merge 管线，
 * 验证 Candidate Pool 中的 research/industry 分布是否改善。
 *
 * Usage: node scripts/domain/editorial/test-replay-lane.mjs [--date 2026-07-02]
 */

import { createSqliteDatabase } from '../../infrastructure/database.mjs'
import { createSqliteEventReadModel } from '../../read-models/sqlite/event-read-model.mjs'
import { LaneDispatcher } from './lane-dispatcher.mjs'
import { executeLanes, MergeEngine } from './merge-engine.mjs'
import { DEFAULT_LANE_CONFIGS, DEFAULT_MERGE_CONFIG } from './lane-types.mjs'
import { BreakingRule } from './rules/breaking-rule.mjs'
import { DiversityRule } from './rules/diversity-rule.mjs'
import { EditorialMemoryRule } from './rules/memory-rule.mjs'
import { createRuleContext } from './rule-context.mjs'
import { JsonEditorialMemoryStore } from '../../services/editorial-memory-store.mjs'
import { CandidateBuilder } from './candidate-builder.mjs'

const date = process.argv.find(a => a.startsWith('--date'))?.split('=')[1] || '2026-07-02'
const from = `${date}T00:00:00Z`
const to = new Date(new Date(from).getTime() + 86400000).toISOString()

const db = createSqliteDatabase()
const rm = createSqliteEventReadModel(db)
const events = rm.findByWindow(from, to)

console.log(`\n╔══════════════════════════════════════════════╗`)
console.log(`║  真实数据回放 — ${date}`)
console.log(`╚══════════════════════════════════════════════╝`)
console.log(`SQLite Events: ${events.length}`)

// 运行旧架构基准（单 CandidateBuilder）
const memoryStore = new JsonEditorialMemoryStore('/tmp/replay-memory.json')
const ruleContext = createRuleContext({ date, memoryStore })
const oldBuilder = new CandidateBuilder([
  new BreakingRule(), new DiversityRule(), new EditorialMemoryRule(memoryStore),
], { maxSize: 40 })
const oldResult = oldBuilder.build(events, ruleContext)

console.log(`\n── 旧架构（单 CandidateBuilder）──`)
const oldCn = oldResult.finalCandidates.filter(c => ['虎嗅','36氪','量子位'].includes(c.event.source?.name)).length
const oldEn = oldResult.finalCandidates.filter(c => !['虎嗅','36氪','量子位'].includes(c.event.source?.name) && !c.event.source?.name?.startsWith('arXiv')).length
const oldArxiv = oldResult.finalCandidates.filter(c => c.event.source?.name?.startsWith('arXiv')).length
console.log(`  Candidates: ${oldResult.finalCandidates.length}`)
console.log(`  arXiv: ${oldArxiv} | Chinese media: ${oldCn} | English media: ${oldEn}`)

// 运行新架构（Lane Dispatcher + Merge Engine）
console.log(`\n── 新架构（Lane Dispatcher + Merge Engine）──`)

// deriveDomain: 根据 source 信息推断 editorialDomain
// 现有 Event 还没有 editorialDomain 字段，需要从 source + entities 推导
function deriveDomain(event) {
  const src = (event.source?.name || '').toLowerCase()
  if (src.startsWith('arxiv')) return 'research'
  if (['虎嗅','36氪','量子位','techcrunch','semafor','wired ai','the verge','axios',
      'ars technica ai','nvidia blog','aws machine learning','mit technology review',
      'databricks blog','simon willison','hacker news','lesswrong'].some(k => src.includes(k))) {
    return 'industry'
  }
  return '__fallback__'
}

const mappedEvents = events.map(e => ({
  ...e,
  editorialDomain: deriveDomain(e),
}))

const dispatcher = new LaneDispatcher()
const laneMap = dispatcher.dispatch(mappedEvents, DEFAULT_LANE_CONFIGS)

console.log(`Lane 分布:`)
for (const [laneId, laneEvents] of laneMap) {
  console.log(`  ${laneId}: ${laneEvents.length} events`)
}

const rules = [
  new BreakingRule(), new DiversityRule(), new EditorialMemoryRule(memoryStore),
]
const laneResults = executeLanes(laneMap, DEFAULT_LANE_CONFIGS, ruleContext, rules)

console.log(`\nLane 构建结果:`)
for (const [laneId, result] of laneResults) {
  console.log(`  ${laneId}: ${result.candidates.length} candidates (in=${result.stats.in} out=${result.stats.out})`)
}

const engine = new MergeEngine(DEFAULT_MERGE_CONFIG)
const mergeResult = engine.merge(laneResults)

const newCn = mergeResult.candidates.filter(c => ['虎嗅','36氪','量子位'].includes(c.event.source?.name)).length
const newEn = mergeResult.candidates.filter(c => !['虎嗅','36氪','量子位'].includes(c.event.source?.name) && !c.event.source?.name?.startsWith('arXiv')).length
const newArxiv = mergeResult.candidates.filter(c => c.event.source?.name?.startsWith('arXiv')).length

console.log(`\nMerge 结果:`)
console.log(`  Candidates: ${mergeResult.candidates.length}`)
console.log(`  arXiv: ${newArxiv} | Chinese media: ${newCn} | English media: ${newEn}`)

// 按 Lane 分布的最终选池
console.log(`\n最终选池按 Lane 分布:`)
const byLane = {}
for (const c of mergeResult.candidates) {
  byLane[c._laneId] = (byLane[c._laneId] || 0) + 1
}
for (const [lid, count] of Object.entries(byLane)) {
  console.log(`  ${lid}: ${count}`)
}

// Top 20
console.log(`\nTop 20 Candidates:`)
for (let i = 0; i < Math.min(20, mergeResult.candidates.length); i++) {
  const c = mergeResult.candidates[i]
  const name = c.event.source?.name || '?'
  const title = (c.event.title || '').slice(0, 50)
  const tag = c._laneId?.slice(0, 4) || '?'
  console.log(`  ${String(i+1).padEnd(3)} ${String(c.finalRank).padEnd(4)} [${tag}] ${name.padEnd(15)} | ${title}`)
}

// 比较
console.log(`\n── 对比 ──`)
console.log(`  arXiv 占比: 旧=${oldArxiv}/40 (${(oldArxiv/40*100).toFixed(0)}%)  →  新=${newArxiv}/${mergeResult.candidates.length} (${(newArxiv/mergeResult.candidates.length*100).toFixed(0)}%)`)
console.log(`  行业新闻:   旧=${oldCn+oldEn}/40 (${((oldCn+oldEn)/40*100).toFixed(0)}%)  →  新=${newCn+newEn}/${mergeResult.candidates.length} (${((newCn+newEn)/mergeResult.candidates.length*100).toFixed(0)}%)`)

const improved = (newCn + newEn) > (oldCn + oldEn)
console.log(`\n  行业新闻占比${improved ? '✅ 提升' : '❌ 未提升'}`)

db.close()
