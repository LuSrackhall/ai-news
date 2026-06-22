/**
 * AI 日报 - 口播稿渲染器 (Phase 6b)
 * script.json → script.md
 * Formatter + Template
 */

// ============================================================
// 格式化（复用 render-article 的基础规则）
// ============================================================

function format(text) {
  if (!text) return ''
  return text
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ============================================================
// Template：script.json → Markdown 口播稿
// ============================================================

/**
 * @param {object} script - script.json 结构化数据
 * @param {string} date - 日期 YYYY-MM-DD
 * @returns {string} Markdown 口播稿
 */
export function renderScript(script, date) {
  const sections = []

  sections.push(`# AI 日报口播稿 | ${date}\n`)
  sections.push('---\n')

  // 开场 Hook
  if (script.hook) {
    const dur = script.hook.duration_s || 15
    sections.push(`**[开场 Hook · ${dur}s]**\n`)
    sections.push(format(script.hook.text))
    sections.push('\n---\n')
  }

  // 今日概览
  if (script.overview) {
    const dur = script.overview.duration_s || 15
    sections.push(`**[今日概览 · ${dur}s]**\n`)
    sections.push(format(script.overview.text))
    sections.push('\n---\n')
  }

  // 重磅新闻
  if (script.deep_items && script.deep_items.length > 0) {
    const totalDur = script.deep_items.reduce((sum, item) => sum + (item.duration_s || 30), 0)
    sections.push(`**[重磅新闻 · ${totalDur}s]**\n`)
    for (const item of script.deep_items) {
      const dur = item.duration_s || 30
      sections.push(`**[${dur}s] ${format(item.title)}**\n`)
      sections.push(format(item.text))
      sections.push('')
    }
    sections.push('---\n')
  }

  // 快速浏览
  if (script.quick_items && script.quick_items.length > 0) {
    const totalDur = script.quick_items.reduce((sum, item) => sum + (item.duration_s || 15), 0)
    sections.push(`**[快速浏览 · ${totalDur}s]**\n`)
    for (const item of script.quick_items) {
      const dur = item.duration_s || 15
      sections.push(`**[${dur}s] ${format(item.title)}**\n`)
      sections.push(format(item.text))
      sections.push('')
    }
    sections.push('---\n')
  }

  // 收尾
  if (script.closing) {
    const dur = script.closing.duration_s || 15
    sections.push(`**[收尾 · ${dur}s]**\n`)
    sections.push(format(script.closing.text))
    sections.push('\n---\n')
  }

  // 计算总时长
  const totalSeconds = [
    script.hook?.duration_s || 0,
    script.overview?.duration_s || 0,
    ...(script.deep_items || []).map((i) => i.duration_s || 0),
    ...(script.quick_items || []).map((i) => i.duration_s || 0),
    script.closing?.duration_s || 0,
  ].reduce((a, b) => a + b, 0)

  sections.push(`\n*总时长: ${Math.floor(totalSeconds / 60)}分${totalSeconds % 60}秒 | AI 辅助生成*`)

  return sections.join('\n')
}
