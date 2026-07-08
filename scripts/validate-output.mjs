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

import { readFileSync, readdirSync, existsSync } from 'node:fs'

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

if (arg === 'all') {
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
