/**
 * Render Domain — 合并 render-article.mjs + render-script.mjs
 * 支持 v4 Artifact content 层（camelCase）和 v3 格式（snake_case）双重输入
 */

export function createRenderDomain(ctx) {
  // ── Formatter（从 render-article.mjs 迁移）──

  function normalizeQuotes(text) {
    return text.replace(/"([^"]*)"/g, '「$1」').replace(/'([^']*)'/g, '「$1」')
  }

  function normalizePunctuation(text) {
    return text
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

  // ── 兼容读取：支持 camelCase 和 snake_case ──

  function getSummaryItems(content) {
    return content.summaryItems || content.summary_items || []
  }
  function getDeepItems(content) {
    return content.deepItems || content.deep_items || []
  }
  function getImportantItems(content) {
    return content.importantItems || content.important_items || []
  }
  function getBriefItems(content) {
    return content.briefItems || content.brief_items || []
  }
  function getOneLiner(item) {
    return item.oneLiner || item.one_liner || ''
  }
  function getWhatHappened(item) {
    return item.whatHappened || item.what_happened || ''
  }
  function getWhyMatters(item) {
    return item.whyMatters || item.why_matters || ''
  }
  function getKeyPoint(item) {
    return item.keyPoint || item.key_point || ''
  }
  function getDurationS(item) {
    return item.durationS || item.duration_s || 0
  }

  // ── 文章渲染 ──

  function renderArticle(content, date, sources = [], stats = {}) {
    const sections = []
    sections.push(`# AI 日报 | ${date}\n`)

    if (content.hook) sections.push(`> ${format(content.hook)}\n`)

    const summaryItems = getSummaryItems(content)
    if (summaryItems.length > 0) {
      sections.push('## 今日速览\n')
      for (const item of summaryItems) {
        sections.push(`- **${format(item.title)}**：${format(getOneLiner(item))}`)
      }
      sections.push('')
    }

    const deepItems = getDeepItems(content)
    if (deepItems.length > 0) {
      sections.push('## 重磅深度\n')
      for (const item of deepItems) {
        sections.push(`### ${format(item.title)}\n`)
        if (getWhatHappened(item)) sections.push(`**发生了什么**：${format(getWhatHappened(item))}\n`)
        if (item.details) sections.push(`**技术/商业细节**：${format(item.details)}\n`)
        if (getWhyMatters(item)) sections.push(`**为什么重要**：${format(getWhyMatters(item))}\n`)
        if (item.implications) sections.push(`**意味着什么**：${format(item.implications)}\n`)
        if (item.sources?.length > 0) {
          const sourceLinks = item.sources.map((s) => `[${s.name}](${ensureClickableUrl(s.url)})`).join(' | ')
          sections.push(`> 来源：${sourceLinks}\n`)
        }
      }
    }

    const importantItems = getImportantItems(content)
    if (importantItems.length > 0) {
      sections.push('## 重要动态\n')
      for (const item of importantItems) {
        sections.push(`### ${format(item.title)}\n`)
        if (getKeyPoint(item)) sections.push(`**要点**：${format(getKeyPoint(item))}\n`)
        if (item.analysis) sections.push(`${format(item.analysis)}\n`)
        if (item.source) {
          const src = typeof item.source === 'object' ? item.source : { name: item.source }
          sections.push(`> 来源：[${src.name}](${ensureClickableUrl(src.url)})\n`)
        }
      }
    }

    const briefItems = getBriefItems(content)
    if (briefItems.length > 0) {
      sections.push('## 快讯\n')
      for (const item of briefItems) {
        const url = item.source_url || item.url || ''
        const source = item.source ? (url ? ` ([${item.source}](${ensureClickableUrl(url)}))` : ` (${item.source})`) : ''
        sections.push(`- **${format(item.title)}**：${format(item.fact)}${source}`)
      }
      sections.push('')
    }

    if (content.editorial) {
      sections.push('## 编辑观点\n')
      const ed = content.editorial
      const parts = [ed.observation, ed.evidence, ed.judgment, ed.prediction].filter(Boolean).map(format)
      sections.push(parts.join('\n\n'))
      sections.push('')
    }

    sections.push('---\n')
    const sourceStr = sources.length > 0 ? sources.join('、') : '多个权威来源'
    sections.push(`*数据来源: ${sourceStr} | AI 辅助生成，经审核*`)
    if (stats.selected) sections.push(`*入选：${stats.selected} 条*`)

    return collapseBlankLines(sections.join('\n'))
  }

  // ── 口播稿渲染 ──

  function renderScript(content, date) {
    const sections = []
    sections.push(`# AI 日报口播稿 | ${date}\n---\n`)

    if (content.hook) {
      const dur = getDurationS(content.hook) || 15
      sections.push(`**[开场 Hook · ${dur}s]**\n${format(content.hook.text)}\n\n---\n`)
    }

    if (content.overview) {
      const dur = getDurationS(content.overview) || 15
      sections.push(`**[今日概览 · ${dur}s]**\n${format(content.overview.text)}\n\n---\n`)
    }

    const deepItems = content.deepItems || content.deep_items || []
    if (deepItems.length > 0) {
      const totalDur = deepItems.reduce((sum, i) => sum + (getDurationS(i) || 30), 0)
      sections.push(`**[重磅新闻 · ${totalDur}s]**\n`)
      for (const item of deepItems) {
        const dur = getDurationS(item) || 30
        sections.push(`**[${dur}s] ${format(item.title)}**\n${format(item.text)}\n`)
      }
      sections.push('---\n')
    }

    const quickItems = content.quickItems || content.quick_items || []
    if (quickItems.length > 0) {
      const totalDur = quickItems.reduce((sum, i) => sum + (getDurationS(i) || 15), 0)
      sections.push(`**[快速浏览 · ${totalDur}s]**\n`)
      for (const item of quickItems) {
        const dur = getDurationS(item) || 15
        sections.push(`**[${dur}s] ${format(item.title)}**\n${format(item.text)}\n`)
      }
      sections.push('---\n')
    }

    if (content.closing) {
      const dur = getDurationS(content.closing) || 15
      sections.push(`**[收尾 · ${dur}s]**\n${format(content.closing.text)}\n\n---\n`)
    }

    const totalSeconds = [
      getDurationS(content.hook) || 0,
      getDurationS(content.overview) || 0,
      ...deepItems.map((i) => getDurationS(i) || 0),
      ...quickItems.map((i) => getDurationS(i) || 0),
      getDurationS(content.closing) || 0,
    ].reduce((a, b) => a + b, 0)

    sections.push(`\n*总时长: ${Math.floor(totalSeconds / 60)}分${totalSeconds % 60}秒 | AI 辅助生成*`)
    return sections.join('\n')
  }

  // ── 核心接口 ──

  return {
    article(content, context = {}) {
      return renderArticle(content, ctx.environment.date, context.sources || [], context.stats || {})
    },

    script(content) {
      return renderScript(content, ctx.environment.date)
    },
  }
}
