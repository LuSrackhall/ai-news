#!/usr/bin/env node
/**
 * Real Data Replay Test — CandidateBuilder 真实数据回放
 *
 * 从生产输出目录读取 curated.json，转换成 CandidateBuilder 能消费的 Event 格式，
 * 回放验证三条 Rule（Breaking, Diversity, Memory）在实际数据上的行为。
 *
 * Usage:
 *   node scripts/domain/editorial/test-replay.mjs --date 2026-07-02
 *   node scripts/domain/editorial/test-replay.mjs --date 2026-07-01
 *   node scripts/domain/editorial/test-replay.mjs --latest
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CandidateBuilder } from './candidate-builder.mjs'
import { BreakingRule } from './rules/breaking-rule.mjs'
import { DiversityRule } from './rules/diversity-rule.mjs'
import { EditorialMemoryRule } from './rules/memory-rule.mjs'
import { createRuleContext } from './rule-context.mjs'
import { JsonEditorialMemoryStore } from '../../services/editorial-memory-store.mjs'

// ─── Path resolution ───
const __dirname = dirname(fileURLToPath(import.meta.url))
const WORKTREE_ROOT = resolve(__dirname, '..', '..', '..')

// 父项目 output 目录的三种可能位置
const CANDIDATE_OUTPUTS = [
  join(WORKTREE_ROOT, '..', '..', '..', 'output'),  // Ai-ribao/output/
  join(WORKTREE_ROOT, '..', '..', '..', 'data', 'output'), // Ai-ribao/data/output/
]

function findMainOutputDir() {
  for (const p of CANDIDATE_OUTPUTS) {
    if (existsSync(p)) return p
  }
  return null
}

// ─── CLI arg parsing ───
const args = process.argv.slice(2)
const dateFlagIdx = args.indexOf('--date')
const date = dateFlagIdx >= 0 ? args[dateFlagIdx + 1] : null
const isLatest = args.includes('--latest')

// ─── 根据 importance 映射 score ───
const IMPORTANCE_SCORE = { deep: 92, important: 70, brief: 50 }

function findOutputDir() {
  const outputDir = findMainOutputDir()
  if (!outputDir) return null

  if (isLatest || !date) {
    const entries = []
    try {
      const names = readdirSync(outputDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name.match(/^\d{4}-\d{2}-\d{2}$/))
        .map((d) => d.name)
      for (const name of names) {
        const full = join(outputDir, name)
        try {
          if (name.match(/^\d{4}-\d{2}-\d{2}$/) && existsSync(full)) {
            entries.push({ date: name, path: full })
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
    entries.sort((a, b) => b.date.localeCompare(a.date))
    return entries[0] || null
  }

  const targetPath = join(outputDir, date)
  return existsSync(targetPath) ? { date, path: targetPath } : null
}

function findCuratedJson(dirInfo) {
  const curatedPath = join(dirInfo.path, 'curated.json')
  if (existsSync(curatedPath)) return curatedPath
  const rawPath = join(dirInfo.path, 'all-raw.json')
  if (existsSync(rawPath)) return rawPath
  const rawDir = join(dirInfo.path, 'raw')
  if (existsSync(rawDir)) {
    try {
      for (const f of readdirSync(rawDir)) {
        if (f.endsWith('.json')) {
          const fp = join(rawDir, f)
          const content = JSON.parse(readFileSync(fp, 'utf-8'))
          if (Array.isArray(content) || content.selected_items || content.items) return fp
        }
      }
    } catch { /* skip */ }
  }
  return null
}

/**
 * 将 curated item 转换成 CandidateBuilder 所需的 Event 格式
 */
function toEvent(item) {
  const curation = item.curation || {}
  const importance = curation.importance || item.importance || 'brief'
  const category = curation.category || item.category || 'uncategorized'
  const score = IMPORTANCE_SCORE[importance] || 50

  return {
    id: item.id,
    title: item.title,
    url: item.url || item.link || '',
    source_name: item.source_name || '',
    source: {
      name: item.source_name || '',
      url: item.url || item.link || '',
    },
    summary: item.summary || item.description || '',
    publishedAt: item.publishedAt || item.pubDate || item.published_at || '',
    entities: item.entities || [],
    category,
    eventType: item.eventType || item.event_type || '',
    curation,
    cluster_size: item.cluster_size || 1,
    clusterId: item.clusterId || null,
    rank: { totalScore: score },
    rank_total: score,
    metadata: {
      clusterSize: item.metadata?.clusterSize || item.cluster_size || 1,
      category,
    },
  }
}

// ─── Report helpers ───
function summarizeSignals(signalLog) {
  const summary = {}
  for (const sig of signalLog) {
    summary[sig.subtype] = (summary[sig.subtype] || 0) + 1
  }
  return summary
}

function getCategoryDistribution(candidates) {
  const dist = {}
  for (const c of candidates) {
    const cat = c.event.category || 'uncategorized'
    dist[cat] = (dist[cat] || 0) + 1
  }
  return dist
}

function formatContextHints(result) {
  const hints = []
  for (const c of result.finalCandidates) {
    if (c.contextHints.length > 0) {
      hints.push({ event: c.event.title.slice(0, 50), hints: c.contextHints })
    }
  }
  return hints
}

// ─── Main ───
async function main() {
  const dirInfo = findOutputDir()
  if (!dirInfo) {
    console.error('未能找到 output 目录或指定日期的数据。')
    console.error('尝试检查以下路径:')
    for (const p of CANDIDATE_OUTPUTS) {
      console.error(`  - ${p} (${existsSync(p) ? 'exists' : 'not found'})`)
    }
    process.exit(1)
  }

  const curatedPath = findCuratedJson(dirInfo)
  if (!curatedPath) {
    console.error(`在 ${dirInfo.path} 下未找到 curated.json 或 all-raw.json`)
    process.exit(1)
  }

  const raw = JSON.parse(readFileSync(curatedPath, 'utf-8'))
  const items = raw.selected_items || raw.items || (Array.isArray(raw) ? raw : [])
  const reportDate = dirInfo.date

  const events = items.map(toEvent)

  // 设置 memory store：尝试加载历史记忆
  const mainMemoryPath = join(WORKTREE_ROOT, 'data', 'editorial-memory.json')
  const mainMemoryStore = existsSync(mainMemoryPath)
    ? new JsonEditorialMemoryStore(mainMemoryPath)
    : null

  const testMemoryPath = `/tmp/editorial-memory-replay-${Date.now()}.json`
  let replayMemoryStore

  if (mainMemoryStore) {
    const sevenDaysBefore = new Date(new Date(reportDate).getTime() - 7 * 86400000).toISOString().slice(0, 10)
    const history = mainMemoryStore.load(sevenDaysBefore)
    writeFileSync(testMemoryPath, JSON.stringify(history, null, 2))
    replayMemoryStore = new JsonEditorialMemoryStore(testMemoryPath)
  } else {
    writeFileSync(testMemoryPath, JSON.stringify({ days: {} }))
    replayMemoryStore = new JsonEditorialMemoryStore(testMemoryPath)
  }

  const ruleContext = createRuleContext({ date: reportDate, memoryStore: replayMemoryStore })

  const builder = new CandidateBuilder([
    new BreakingRule(),
    new DiversityRule(),
    new EditorialMemoryRule(replayMemoryStore),
  ])

  console.log(`\n[Replay] 开始回放: ${reportDate}`)
  console.log(`[Replay] 事件数: ${events.length}`)
  console.log(`[Replay] Curated 来源: ${curatedPath}\n`)

  const result = builder.build(events, ruleContext)

  const sigSummary = summarizeSignals(result.signalLog)
  const catDist = getCategoryDistribution(result.finalCandidates)
  const hints = formatContextHints(result)

  // ─── Report ───
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║              真实数据回放报告                                ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log()

  console.log('## 数据源')
  console.log(`- 日期: ${reportDate}`)
  console.log(`- 事件数: ${events.length}`)
  console.log(`- 来源文件: ${curatedPath}`)
  console.log()

  console.log('## CandidateBuilder 结果')
  console.log(`- Signal Log 汇总:`)
  for (const [type, count] of Object.entries(sigSummary)) {
    console.log(`  - ${type}: ${count} 条`)
  }
  console.log(`- Filtered In: ${result.filteredIn}`)
  console.log(`- Filtered Out: ${result.filteredOut}`)
  console.log(`- Final Candidates: ${result.finalCandidates.length} 条`)
  console.log()

  console.log('## Category 分布')
  const sortedCats = Object.entries(catDist).sort((a, b) => b[1] - a[1])
  for (const [cat, count] of sortedCats) {
    console.log(`- ${cat}: ${count} 条`)
  }
  if (sortedCats.length === 0) console.log('- (无)')
  console.log()

  console.log('## Final Candidates (按 Rank)')
  for (let i = 0; i < result.finalCandidates.length; i++) {
    const c = result.finalCandidates[i]
    console.log(`  ${String(i + 1).padStart(2)}. [${String(c.finalRank).padStart(3)}] ${c.event.title.slice(0, 60)} (${c.event.category})`)
  }
  if (result.finalCandidates.length === 0) console.log('- (无)')
  console.log()

  if (hints.length > 0) {
    console.log('## contextHints 示例')
    for (const h of hints) {
      console.log(`- ${h.event}: ${h.hints[0].slice(0, 80)}`)
    }
    console.log()
  } else {
    console.log('## contextHints: (无)')
    console.log()
  }

  // Signal 完整明细
  if (result.signalLog.length > 0) {
    console.log('## Signal Log 完整明细')
    for (const sig of result.signalLog) {
      const evtInfo = sig.metadata?.eventId ? ` [evt: ${sig.metadata.eventId}]` : ''
      const entInfo = sig.metadata?.entity ? ` (entity: ${sig.metadata.entity})` : ''
      console.log(`  [${sig.phase}] ${sig.subtype.padEnd(16)} ${sig.source.padEnd(18)} ${sig.reason}${evtInfo}${entInfo}`)
    }
    console.log()
  }

  // 结论
  const hasAnomaly = result.finalCandidates.length === 0 && events.length > 0
  const coverageOk = Object.keys(catDist).length >= 3
  console.log('## 结论')
  console.log(`- 是否有异常: ${hasAnomaly ? '是' : '否'}`)
  console.log(`- 真实数据下表现: ${coverageOk ? '预期' : '需关注（category 覆盖不足）'}`)
  if (result.finalCandidates.length > 0 && result.finalCandidates.length <= 40) {
    console.log(`- 候选池大小: 合理 (${result.finalCandidates.length})`)
  } else if (result.finalCandidates.length > 40) {
    console.log(`- 候选池: 超过上限 (${result.finalCandidates.length})`)
  } else {
    console.log(`- 候选池: 为空`)
  }

  console.log('\n✅ 回放完成\n')
}

main().catch((err) => {
  console.error('回放出错:', err)
  process.exit(1)
})
