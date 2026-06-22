/**
 * AI 日报 - 文章渲染器 (Phase 6a)
 * article.json → article.md
 * Formatter + Template
 *
 * renderer_version 独立管理
 */

export const RENDERER_VERSION = 'v1'

// ============================================================
// Formatter：统一格式化
// ============================================================

function normalizeQuotes(text) {
  return text
    .replace(/"([^"]*)"/g, '「$1」')
    .replace(/'([^']*)'/g, '「$1」')
}

function normalizePunctuation(text) {
  return text
    .replace(/，/g, '，')
    .replace(/。/g, '。')
    .replace(/：/g, '：')
    .replace(/；/g, '；')
    .replace(/！/g, '！')
    .replace(/？/g, '？')
    // 半角标点后面如果有中文，转为全角
    .replace(/,(?=[一-鿿])/g, '，')
    .replace(/\.(?=[一-鿿])/g, '。')
    .replace(/:(?=[一-鿿])/g, '：')
}

function collapseBlankLines(text) {
  return text.replace(/\n{3,}/g, '\n\n')
}

function ensureClickableUrl(url) {
  if (!url) return ''
  if (!url.startsWith('http')) return `https://${url}`
  return url
}

function format(text) {
  if (!text) return ''
  return collapseBlankLines(normalizePunctuation(normalizeQuotes(text))).trim()
}

// ============================================================
// Template：article.json → Markdown
// ============================================================

/**
 * @param {object} article - article.json 结构化数据
 * @param {string} date - 日期 YYYY-MM-DD
 * @param {string[]} sources - 数据来源列表
 * @param {object} stats - 统计信息 { collected, verified, selected }
 * @returns {string} Markdown 文章
 */
export function renderArticle(article, date, sources = [], stats = {}) {
  const sections = []

  // 标题
  sections.push(`# AI 日报 | ${date}\n`)

  // 钩子
  if (article.hook) {
    sections.push(`> ${format(article.hook)}\n`)
  }

  // 今日速览
  if (article.summary_items && article.summary_items.length > 0) {
    sections.push('## 今日速览\n')
    for (const item of article.summary_items) {
      sections.push(`- **${format(item.title)}**：${format(item.one_liner)}`)
    }
    sections.push('')
  }

  // 重磅深度
  if (article.deep_items && article.deep_items.length > 0) {
    sections.push('## 重磅深度\n')
    for (const item of article.deep_items) {
      sections.push(`### ${format(item.title)}\n`)
      if (item.what_happened) {
        sections.push(`**发生了什么**：${format(item.what_happened)}\n`)
      }
      if (item.details) {
        sections.push(`**技术/商业细节**：${format(item.details)}\n`)
      }
      if (item.why_matters) {
        sections.push(`**为什么重要**：${format(item.why_matters)}\n`)
      }
      if (item.implications) {
        sections.push(`**意味着什么**：${format(item.implications)}\n`)
      }
      if (item.sources && item.sources.length > 0) {
        const sourceLinks = item.sources
          .map((s) => `[${s.name}](${ensureClickableUrl(s.url)})`)
          .join(' | ')
        sections.push(`> 来源：${sourceLinks}\n`)
      }
    }
  }

  // 重要动态
  if (article.important_items && article.important_items.length > 0) {
    sections.push('## 重要动态\n')
    for (const item of article.important_items) {
      sections.push(`### ${format(item.title)}\n`)
      if (item.key_point) {
        sections.push(`**要点**：${format(item.key_point)}\n`)
      }
      if (item.analysis) {
        sections.push(`${format(item.analysis)}\n`)
      }
      if (item.source) {
        sections.push(`> 来源：[${item.source.name}](${ensureClickableUrl(item.source.url)})\n`)
      }
    }
  }

  // 快讯
  if (article.brief_items && article.brief_items.length > 0) {
    sections.push('## 快讯\n')
    for (const item of article.brief_items) {
      const source = item.source ? ` ([${item.source}](${ensureClickableUrl(item.source_url || '')}))` : ''
      sections.push(`- **${format(item.title)}**：${format(item.fact)}${source}`)
    }
    sections.push('')
  }

  // 编辑观点
  if (article.editorial) {
    sections.push('## 编辑观点\n')
    const parts = []
    if (article.editorial.observation) parts.push(format(article.editorial.observation))
    if (article.editorial.evidence) parts.push(format(article.editorial.evidence))
    if (article.editorial.judgment) parts.push(format(article.editorial.judgment))
    if (article.editorial.prediction) parts.push(format(article.editorial.prediction))
    sections.push(parts.join('\n\n'))
    sections.push('')
  }

  // 页脚
  sections.push('---\n')
  const sourceStr = sources.length > 0 ? sources.join('、') : '多个权威来源'
  const statsStr = stats.selected ? `入选：${stats.selected} 条` : ''
  sections.push(`*数据来源: ${sourceStr} | AI 辅助生成，经审核*`)
  if (statsStr) sections.push(`*${statsStr}*`)

  return collapseBlankLines(sections.join('\n'))
}
