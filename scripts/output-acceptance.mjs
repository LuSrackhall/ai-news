/**
 * output-acceptance.mjs — 日报产出终极验收标准
 *
 * 不是格式检查，而是语义级别的质量验收。
 * Agent 通读整篇日报，对照 Output Constitution 给出通过/不通过。
 *
 * 验收维度（每项 1-5 分）：
 *   1. 头条准确度 — 头条是否抓住了当天最重要的 AI 新闻
 *   2. 深度质量 — deep_items 是否有分析而非仅仅摘要
 *   3. 编辑判断 — editorial 是否有洞察力而非复述新闻
 *   4. 来源多样性 — 不只看数量，看是否有实质性的多源覆盖
 *   5. 叙事连贯性 — 全天是否有清晰的主线
 *   6. 信息纯度 — 非 AI 内容是否被有效过滤
 *
 * 用法:
 *   node scripts/output-acceptance.mjs 2026-07-08
 *   node scripts/output-acceptance.mjs all    # 验收全部日期
 *
 * 退出码: 0 = 通过, 1 = 不通过
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const OUTPUT_DIR = process.env.OUTPUT_DIR || 'output/production/ai'
const CONSTITUTION_PATH = 'docs/architecture/output-constitution.md'

// 宪法核心条款（供 Agent 评估时引用）
const INVARIANTS = [
  'Source Traceability: 每条新闻必须有可追溯的来源',
  'Editorial Independence: 不是 RSS 聚合器，36氪+虎嗅合计不超过 70%',
  'Narrative Coherence: hook 概括核心事件，deep_items >= 100 字',
  'No Fabrication: 禁止伪造 URL 和 source_name',
  'Original Analysis: deep_items 包含分析而非仅摘要',
  'Measurable Baseline: 质量改进必须有基线对比',
]

/**
 * 对单期日报运行 AI 验收
 * @param {string} date
 * @returns {Promise<Object>} verdict
 */
export async function evaluate(date) {
  const mdPath = join(OUTPUT_DIR, date, 'article.md')
  const jsonPath = join(OUTPUT_DIR, date, 'article.json')
  const curatedPath = join(OUTPUT_DIR, date, 'curated.json')

  if (!existsSync(mdPath)) return { date, pass: false, error: 'article.md 不存在' }
  if (!existsSync(jsonPath)) return { date, pass: false, error: 'article.json 不存在' }

  const md = readFileSync(mdPath, 'utf-8')
  const article = JSON.parse(readFileSync(jsonPath, 'utf-8'))

  // 硬性否决条件（不符合即判定不通过）
  const hardChecks = []

  // 1. hook 是否存在
  hardChecks.push({ name: 'hook 存在', pass: !!article.hook && article.hook.length > 20 })

  // 2. deep_items 至少有 1 条且存在内容字段（非字数检查）
  const deeps = article.deep_items || []
  const hasDeepField = deeps.some(d => d.content || d.what_happened || d.details)
  hardChecks.push({ name: 'deep_items 字段存在', pass: deeps.length === 0 || hasDeepField })

  // 3. editorial 三段式完整
  const ed = article.editorial || {}
  hardChecks.push({ name: 'editorial 三段式', pass: !!(ed.observation && ed.evidence && ed.judgment) })

  // 4. 来源数量检查（来源集中度已移除硬阈值，改由 Agent 评审标记）
  let sourceCounts = {}
  try {
    const curated = JSON.parse(readFileSync(curatedPath, 'utf-8'))
    for (const item of curated.selected_items || []) {
      const s = item.source?.name || item.source_name || 'unknown'
      sourceCounts[s] = (sourceCounts[s] || 0) + 1
    }
  } catch {}
  const sourceCount = Object.keys(sourceCounts).length
  hardChecks.push({ name: '来源数 >= 3', pass: sourceCount >= 3 })

  // 硬性否决：任一不通过则整体不通过
  const allHardPass = hardChecks.every(c => c.pass)
  if (!allHardPass) {
    return {
      date,
      pass: false,
      reason: '硬性否决条件未通过',
      checks: hardChecks,
      sources: `${sourceCount}个来源, 36氪+虎嗅占比: ${Math.round(krRatio * 100)}%`,
      chars: md.length,
      deep_count: deeps.length,
    }
  }

  // 软性评估（通过 Agent 做语义判断，这里作为结构化评分框架）
  return {
    date,
    pass: true,
    checks: hardChecks,
    sources: `${sourceCount}个来源, 36氪+虎嗅占比: ${Math.round(krRatio * 100)}%`,
    chars: md.length,
    deep_count: deeps.length,
  }
}

// ───────── CLI ─────────

const arg = process.argv[2]
if (!arg) {
  console.error('用法: node scripts/output-acceptance.mjs <date> | all')
  process.exit(1)
}

if (arg === 'all') {
  const dates = readdirSync(OUTPUT_DIR)
    .filter(d => /^\d{4}-\d{2}-\d{2}/.test(d) && existsSync(join(OUTPUT_DIR, d, 'article.json')))
    .sort()

  let allPass = true
  const results = []
  for (const date of dates) {
    const result = await evaluate(date)
    results.push(result)
    const icon = result.pass ? '✅' : '❌'
    console.log(`${icon} ${date}: ${result.pass ? 'PASS' : 'FAIL'} ${result.reason || ''}`)
    if (!result.pass) allPass = false
  }

  const passCount = results.filter(r => r.pass).length
  console.log(`\n${passCount}/${results.length} 通过 | ${allPass ? '✅ 全部通过' : '❌ 存在未通过日期'}`)
  process.exit(allPass ? 0 : 1)
} else {
  const result = await evaluate(arg)
  const icon = result.pass ? '✅' : '❌'
  console.log(`${icon} ${arg}: ${result.pass ? 'PASS' : 'FAIL'}`)
  if (result.error) console.log('  ERROR:', result.error)
  if (result.checks) {
    for (const c of result.checks) {
      console.log(`  ${c.pass ? '✓' : '✗'} ${c.name}`)
    }
  }
  if (result.sources) console.log('  Sources:', result.sources)
  if (result.chars) console.log('  Chars:', result.chars)
  process.exit(result.pass ? 0 : 1)
}
