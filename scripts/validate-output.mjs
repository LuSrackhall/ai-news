/**
 * validate-output.mjs — 日报产出质量回归测试
 *
 * 检查 output/<date>/ 中的 article.json 和 article.md 是否符合格式规范。
 *
 * 用法: node scripts/validate-output.mjs <date>
 *       node scripts/validate-output.mjs all   # 检查所有有数据的日期
 *
 * 退出码: 0 = 全部通过, 1 = 有失败项
 */

import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'

const OUTPUT_DIR = 'output'

// ───────── 检查规则 ─────────

const CHECKS = {
  'summary_items 数量 3~6': (a) => {
    const n = a.summary_items?.length || 0
    return { pass: n >= 3 && n <= 6, detail: `${n}条` }
  },
  'summary_items 无 source': (a) => {
    const has = (a.summary_items || []).some(i => i.source || i.sources)
    return { pass: !has, detail: has ? '含 source 字段' : '合规' }
  },
  'deep_items 有 content': (a) => {
    const missing = (a.deep_items || []).filter(i => !i.content || i.content.length < 50)
    return { pass: missing.length === 0, detail: missing.length > 0 ? `${missing.length} 条 content 不足` : '合规' }
  },
  'deep_items 有 sources 数组': (a) => {
    const missing = (a.deep_items || []).filter(i => !i.sources || i.sources.length === 0)
    return { pass: missing.length === 0, detail: missing.length > 0 ? `${missing.length} 条缺少 sources` : '合规' }
  },
  'important_items 有 source 对象': (a) => {
    const missing = (a.important_items || []).filter(i => !i.source?.name || !i.source?.url)
    return { pass: missing.length === 0, detail: missing.length > 0 ? `${missing.length} 条缺少 source` : '合规' }
  },
  'brief_items 有 sources 数组': (a) => {
    const missing = (a.brief_items || []).filter(i => !i.sources || i.sources.length === 0)
    return { pass: missing.length === 0, detail: missing.length > 0 ? `${missing.length} 条缺少 sources` : '合规' }
  },
  'editorial 三段式完整': (a) => {
    const e = a.editorial || {}
    const missing = []
    if (!e.observation || e.observation.length < 10) missing.push('observation')
    if (!e.evidence || e.evidence.length < 10) missing.push('evidence')
    if (!e.judgment || e.judgment.length < 10) missing.push('judgment')
    return { pass: missing.length === 0, detail: missing.length > 0 ? `缺: ${missing.join(', ')}` : '合规' }
  },
  'hook 存在': (a) => {
    return { pass: !!a.hook, detail: a.hook ? a.hook.slice(0, 40) + '...' : '缺失' }
  },
  'article.md 存在且非空': (_a, date) => {
    const path = `output/${date}/article.md`
    if (!existsSync(path)) return { pass: false, detail: '文件不存在' }
    const content = readFileSync(path, 'utf-8')
    return { pass: content.length > 2000, detail: `${content.length} chars` }
  },
  'article.md 无速览来源链接': (_a, date) => {
    const content = readFileSync(`output/${date}/article.md`, 'utf-8')
    const lines = content.split('\n')
    let inSummary = false
    let violations = 0
    for (const line of lines) {
      if (line.startsWith('## 速览')) inSummary = true
      else if (line.startsWith('## 深度')) inSummary = false
      else if (inSummary && line.includes('*来源：')) violations++
    }
    return { pass: violations === 0, detail: violations > 0 ? `${violations} 处来源链接` : '合规' }
  },
  'article.md 有编辑观察/证据/判断': (_a, date) => {
    const content = readFileSync(`output/${date}/article.md`, 'utf-8')
    const hasObs = content.includes('**编辑观察：**')
    const hasEvd = content.includes('**证据：**')
    const hasJdg = content.includes('**判断：**')
    const missing = []
    if (!hasObs) missing.push('编辑观察')
    if (!hasEvd) missing.push('证据')
    if (!hasJdg) missing.push('判断')
    return { pass: missing.length === 0, detail: missing.length > 0 ? `缺: ${missing.join(', ')}` : '三段齐全' }
  },
}

// ───────── 运行 ─────────

function validateDate(date) {
  const jsonPath = `${OUTPUT_DIR}/${date}/article.json`
  if (!existsSync(jsonPath)) return null

  const article = JSON.parse(readFileSync(jsonPath, 'utf-8'))
  const results = []

  for (const [name, check] of Object.entries(CHECKS)) {
    const result = check(article, date)
    results.push({ name, ...result })
  }

  return results
}

function printResults(date, results) {
  const pass = results.filter(r => r.pass).length
  const fail = results.filter(r => !r.pass).length
  console.log(`\n${date}: ${pass}/${pass+fail} 通过`)
  for (const r of results) {
    const icon = r.pass ? '✅' : '❌'
    console.log(`  ${icon} ${r.name}: ${r.detail}`)
  }
  return fail === 0
}

// CLI
const arg = process.argv[2]
if (!arg) {
  console.error('用法: node scripts/validate-output.mjs <date> | all')
  process.exit(1)
}

if (arg === 'baseline' || arg === 'compare') {
  // Handled by the bottom-of-file baseline/compare code
} else if (arg === 'all') {
  const dates = readdirSync(OUTPUT_DIR).filter(d => /^\d{4}-\d{2}-\d{2}/.test(d) && existsSync(`${OUTPUT_DIR}/${d}/article.json`)).sort()
  console.log(`检查 ${dates.length} 天的日报产出\n`)
  let allPass = true
  for (const date of dates) {
    const results = validateDate(date)
    if (!results) continue
    const pass = printResults(date, results)
    if (!pass) allPass = false
  }
  console.log(`\n${allPass ? '✅ 全部通过' : '❌ 有失败项'}`)
  process.exit(allPass ? 0 : 1)
} else {
  const results = validateDate(arg)
  if (!results) {
    console.error(`未找到 ${arg} 的文章数据`)
    process.exit(1)
  }
  printResults(arg, results)
  const fail = results.filter(r => !r.pass).length
  process.exit(fail === 0 ? 0 : 1)
}

// ═══════════════════════════════════════════
// Baseline 基线统计 & Compare 对比
// ═══════════════════════════════════════════

import { join } from 'node:path'

const BASELINE_PATH = join('.', 'data', 'output-baseline.json')

function extractStats(date) {
  const a = JSON.parse(readFileSync(`${OUTPUT_DIR}/${date}/article.json`, 'utf-8'))
  const c = JSON.parse(readFileSync(`${OUTPUT_DIR}/${date}/curated.json`, 'utf-8'))
  const md = readFileSync(`${OUTPUT_DIR}/${date}/article.md`, 'utf-8')
  const items = c.selected_items || []
  const sourcesList = items.map(i => i.source?.name || i.source_name).filter(Boolean)
  const sourceCounts = {}
  for (const s of sourcesList) { sourceCounts[s] = (sourceCounts[s] || 0) + 1 }
  const totalSources = Object.keys(sourceCounts).length
  const kr36 = sourcesList.filter(s => s.includes('36氪')).length
  const huxiu = sourcesList.filter(s => s.includes('虎嗅')).length
  const intl = sourcesList.filter(s => !/[一-鿿]/.test(s)).length

  return {
    date,
    total_events: a.summary_items?.length + a.deep_items?.length + a.important_items?.length + a.brief_items?.length || 0,
    summary_items: a.summary_items?.length || 0,
    deep_items: a.deep_items?.length || 0,
    important_items: a.important_items?.length || 0,
    brief_items: a.brief_items?.length || 0,
    selected_items: items.length,
    source_count: totalSources,
    kr36_pct: sourcesList.length > 0 ? Math.round(kr36 / sourcesList.length * 100) : 0,
    huxiu_pct: sourcesList.length > 0 ? Math.round(huxiu / sourcesList.length * 100) : 0,
    intl_pct: sourcesList.length > 0 ? Math.round(intl / sourcesList.length * 100) : 0,
    article_chars: md.length,
    deep_has_content: (a.deep_items || []).filter(i => i.content && i.content.length >= 100).length,
    deep_total: (a.deep_items || []).length,
    editorial_complete: [a.editorial?.observation, a.editorial?.evidence, a.editorial?.judgment].filter(Boolean).length >= 3 ? 1 : 0,
    hook_exists: a.hook ? 1 : 0,
  }
}

function formatStats(name, stats) {
  console.log(`\n${name}`)
  console.log(`  ${
    Object.entries(stats).filter(([k]) => k !== 'date').map(([k, v]) =>
      typeof v === 'number' && v === Math.round(v) ? `${k}: ${v}` : `${k}: ${Number(v).toFixed(1)}`
    ).join(' | ')
  }`)
}

if (process.argv[2] === 'baseline') {
  const dates = readdirSync(OUTPUT_DIR).filter(d => /^\d{4}-\d{2}-\d{2}/.test(d)).sort()
  const all = dates.filter(d => existsSync(`${OUTPUT_DIR}/${d}/article.json`)).map(extractStats)
  const avg = {}
  for (const key of Object.keys(all[0] || {}).filter(k => k !== 'date')) {
    const vals = all.map(r => r[key]).filter(v => typeof v === 'number')
    avg[key] = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : 0
  }
  const baseline = { generated_at: new Date().toISOString(), dates_count: all.length, dates: all, avg }
  mkdirSync(join(BASELINE_PATH, '..'), { recursive: true })
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2))
  console.log(`基线已保存: data/output-baseline.json (${all.length} 天)`)
  formatStats('Base (均值)', avg)
  process.exit(0)
}

if (process.argv[2] === 'compare') {
  if (!existsSync(BASELINE_PATH)) {
    console.error('基线不存在，请先运行: node scripts/validate-output.mjs baseline')
    process.exit(1)
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'))
  const dates = readdirSync(OUTPUT_DIR).filter(d => /^\d{4}-\d{2}-\d{2}/.test(d)).sort()
  const current = dates.filter(d => existsSync(`${OUTPUT_DIR}/${d}/article.json`)).map(extractStats)
  const curAvg = {}
  for (const key of Object.keys(baseline.avg)) {
    curAvg[key] = Math.round(current.map(r => r[key]).reduce((a, b) => a + b, 0) / current.length * 10) / 10
  }

  console.log(`\n基线: ${baseline.dates_count} 天 (${baseline.generated_at.slice(0, 10)})`)
  console.log(`当前: ${current.length} 天`)
  console.log('')
  formatStats('Base', baseline.avg)
  formatStats('Now', curAvg)
  console.log('')
  console.log('Diff (Now - Base):')
  let hasDiff = false
  for (const key of Object.keys(baseline.avg)) {
    const diff = (curAvg[key] || 0) - (baseline.avg[key] || 0)
    if (Math.abs(diff) > 0) {
      const icon = diff > 0 ? '↑' : '↓'
      hasDiff = true
      console.log(`  ${key}: ${icon} ${diff > 0 ? '+' : ''}${diff.toFixed(1)}`)
    }
  }
  if (!hasDiff) console.log('  (无显著差异)')
  process.exit(0)
}
