/**
 * RenderPolicy — Article/Script 模板渲染
 * 纯计算，不碰 IO
 */

export class RenderPolicy {
  execute({ type, content, date, sources, stats }) {
    if (type === 'article') return this.renderArticle(content, date, sources, stats)
    if (type === 'script') return this.renderScript(content, date)
    throw new Error(`Unknown render type: ${type}`)
  }

  renderArticle(content, date, sources = [], stats = {}) {
    const sections = []
    sections.push(`# AI 日报 | ${date}\n`)

    if (content.hook) sections.push(`> ${this.fmt(content.hook)}\n`)

    const summaryItems = content.summaryItems || content.summary_items || []
    if (summaryItems.length > 0) {
      sections.push('## 今日速览\n')
      for (const item of summaryItems) {
        sections.push(`- **${this.fmt(item.title)}**：${this.fmt(item.oneLiner || item.one_liner || '')}`)
      }
      sections.push('')
    }

    const deepItems = content.deepItems || content.deep_items || []
    if (deepItems.length > 0) {
      sections.push('## 重磅深度\n')
      for (const item of deepItems) {
        sections.push(`### ${this.fmt(item.title)}\n`)
        if (item.whatHappened || item.what_happened) sections.push(`**发生了什么**：${this.fmt(item.whatHappened || item.what_happened)}\n`)
        if (item.details) sections.push(`**技术/商业细节**：${this.fmt(item.details)}\n`)
        if (item.whyMatters || item.why_matters) sections.push(`**为什么重要**：${this.fmt(item.whyMatters || item.why_matters)}\n`)
        if (item.implications) sections.push(`**意味着什么**：${this.fmt(item.implications)}\n`)
        if (item.sources?.length > 0) {
          sections.push(`> 来源：${item.sources.map((s) => `[${s.name}](${this.url(s.url)})`).join(' | ')}\n`)
        }
      }
    }

    const importantItems = content.importantItems || content.important_items || []
    if (importantItems.length > 0) {
      sections.push('## 重要动态\n')
      for (const item of importantItems) {
        sections.push(`### ${this.fmt(item.title)}\n`)
        if (item.keyPoint || item.key_point) sections.push(`**要点**：${this.fmt(item.keyPoint || item.key_point)}\n`)
        if (item.analysis) sections.push(`${this.fmt(item.analysis)}\n`)
        if (item.source) sections.push(`> 来源：${typeof item.source === 'object' ? `[${item.source.name}](${this.url(item.source.url)})` : item.source}\n`)
      }
    }

    const briefItems = content.briefItems || content.brief_items || []
    if (briefItems.length > 0) {
      sections.push('## 快讯\n')
      for (const item of briefItems) {
        sections.push(`- **${this.fmt(item.title)}**：${this.fmt(item.fact)}`)
      }
      sections.push('')
    }

    if (content.editorial) {
      sections.push('## 编辑观点\n')
      const ed = content.editorial
      const parts = [ed.observation, ed.evidence, ed.judgment, ed.prediction].filter(Boolean).map(this.fmt)
      sections.push(parts.join('\n\n'))
      sections.push('')
    }

    sections.push('---\n')
    const sourceStr = sources.length > 0 ? sources.join('、') : '多个权威来源'
    sections.push(`*数据来源: ${sourceStr} | AI 辅助生成，经审核*`)
    if (stats.selected) sections.push(`*入选：${stats.selected} 条*`)

    return sections.join('\n').replace(/\n{3,}/g, '\n\n')
  }

  renderScript(content, date) {
    const sections = []
    sections.push(`# AI 日报口播稿 | ${date}\n---\n`)

    const getDur = (s) => s?.durationS || s?.duration_s || 0

    if (content.hook) sections.push(`**[开场 Hook · ${getDur(content.hook) || 15}s]**\n${this.fmt(content.hook.text)}\n\n---\n`)
    if (content.overview) sections.push(`**[今日概览 · ${getDur(content.overview) || 15}s]**\n${this.fmt(content.overview.text)}\n\n---\n`)

    const deepItems = content.deepItems || content.deep_items || []
    if (deepItems.length > 0) {
      const totalDur = deepItems.reduce((s, i) => s + (getDur(i) || 30), 0)
      sections.push(`**[重磅新闻 · ${totalDur}s]**\n`)
      for (const item of deepItems) {
        sections.push(`**[${getDur(item) || 30}s] ${this.fmt(item.title)}**\n${this.fmt(item.text)}\n`)
      }
      sections.push('---\n')
    }

    const quickItems = content.quickItems || content.quick_items || []
    if (quickItems.length > 0) {
      const totalDur = quickItems.reduce((s, i) => s + (getDur(i) || 15), 0)
      sections.push(`**[快速浏览 · ${totalDur}s]**\n`)
      for (const item of quickItems) {
        sections.push(`**[${getDur(item) || 15}s] ${this.fmt(item.title)}**\n${this.fmt(item.text)}\n`)
      }
      sections.push('---\n')
    }

    if (content.closing) sections.push(`**[收尾 · ${getDur(content.closing) || 15}s]**\n${this.fmt(content.closing.text)}\n\n---\n`)

    const totalSeconds = [getDur(content.hook), getDur(content.overview), ...deepItems.map(getDur), ...quickItems.map(getDur), getDur(content.closing)].reduce((a, b) => a + b, 0)
    sections.push(`\n*总时长: ${Math.floor(totalSeconds / 60)}分${totalSeconds % 60}秒 | AI 辅助生成*`)
    return sections.join('\n')
  }

  fmt(text) {
    if (!text) return ''
    return text.replace(/\n{3,}/g, '\n\n').trim()
  }

  url(u) {
    if (!u) return ''
    return u.startsWith('http') ? u : `https://${u}`
  }
}
