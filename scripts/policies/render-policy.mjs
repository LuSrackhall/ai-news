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
        const src = item.source || (item.sources?.[0])
        if (src?.url) sections.push(`  > 来源：[${src.name || '原文'}](${this.url(src.url)})`)
      }
      sections.push('')
    }

    const deepItems = content.deepItems || content.deep_items || []
    if (deepItems.length > 0) {
      sections.push('## 重磅深度\n')
      for (const item of deepItems) {
        sections.push(`### ${this.fmt(item.title)}\n`)
        if (item.image) {
          sections.push(`![${item.image_caption || item.title}](${item.image})\n`)
          if (item.image_caption) sections.push(`*${item.image_caption}*\n`)
        }
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
        const tag = item.category ? `**[${this.fmt(item.category)}]** ` : ''
        sections.push(`### ${tag}${this.fmt(item.title)}\n`)
        if (item.image) {
          sections.push(`![${item.title}](${item.image})\n`)
        }
        if (item.keyPoint || item.key_point) sections.push(`**要点**：${this.fmt(item.keyPoint || item.key_point)}\n`)
        if (item.analysis) sections.push(`${this.fmt(item.analysis)}\n`)
        const impSrc = item.source || (item.sources?.[0])
        if (impSrc?.url) sections.push(`> 来源：[${impSrc.name || '原文'}](${this.url(impSrc.url)})\n`)
      }
    }

    const briefItems = content.briefItems || content.brief_items || []
    if (briefItems.length > 0) {
      sections.push('## 快讯\n')
      for (const item of briefItems) {
        sections.push(`- **${this.fmt(item.title)}**：${this.fmt(item.fact)}`)
        const src = item.source || (item.sources?.[0])
        if (src?.url) sections.push(`  > 来源：[${src.name || '原文'}](${this.url(src.url)})`)
      }
      sections.push('')
    }

    if (content.editorial) {
      sections.push('## 编辑观点\n')
      const ed = content.editorial
      const parts = [ed.observation, ed.evidence, ed.judgment].filter(Boolean).map(this.fmt)
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
    sections.push(`# AI 日报播客脚本 | ${date}\n---\n`)

    const getDur = (s) => s?.durationS || s?.duration_s || 0
    const speakerName = (s) => s === 'M' ? '男' : s === 'F' ? '女' : s || ''

    // 渲染对话行
    const renderDialogue = (lines) => {
      if (!Array.isArray(lines)) return ''
      return lines.map(l => `**${speakerName(l.speaker)}**：${this.fmt(l.text)}`).join('\n')
    }

    // 计算对话总时长
    const dialogueDur = (lines) => {
      if (!Array.isArray(lines)) return 0
      return lines.reduce((s, l) => s + getDur(l), 0)
    }

    // 兼容旧格式（单人）和新格式（对话）
    const isDialogue = (item) => Array.isArray(item)

    if (content.hook) {
      const dur = isDialogue(content.hook) ? dialogueDur(content.hook) : getDur(content.hook)
      const text = isDialogue(content.hook) ? renderDialogue(content.hook) : this.fmt(content.hook.text)
      sections.push(`**[开场 Hook · ${dur || 15}s]**\n${text}\n\n---\n`)
    }

    if (content.overview) {
      const dur = isDialogue(content.overview) ? dialogueDur(content.overview) : getDur(content.overview)
      const text = isDialogue(content.overview) ? renderDialogue(content.overview) : this.fmt(content.overview.text)
      sections.push(`**[今日概览 · ${dur || 20}s]**\n${text}\n\n---\n`)
    }

    const deepItems = content.deepItems || content.deep_items || []
    if (deepItems.length > 0) {
      const totalDur = deepItems.reduce((s, i) => s + (i.dialogue ? dialogueDur(i.dialogue) : getDur(i)), 0)
      sections.push(`**[重磅新闻 · ${totalDur}s]**\n`)
      for (const item of deepItems) {
        const dur = item.dialogue ? dialogueDur(item.dialogue) : getDur(item)
        const text = item.dialogue ? renderDialogue(item.dialogue) : this.fmt(item.text)
        sections.push(`**[${dur || 30}s] ${this.fmt(item.title)}**\n${text}\n`)
      }
      sections.push('---\n')
    }

    const quickItems = content.quickItems || content.quick_items || []
    if (quickItems.length > 0) {
      const totalDur = quickItems.reduce((s, i) => s + (i.dialogue ? dialogueDur(i.dialogue) : getDur(i)), 0)
      sections.push(`**[快速浏览 · ${totalDur}s]**\n`)
      for (const item of quickItems) {
        const dur = item.dialogue ? dialogueDur(item.dialogue) : getDur(item)
        const text = item.dialogue ? renderDialogue(item.dialogue) : this.fmt(item.text)
        sections.push(`**[${dur || 15}s] ${this.fmt(item.title)}**\n${text}\n`)
      }
      sections.push('---\n')
    }

    if (content.closing) {
      const dur = isDialogue(content.closing) ? dialogueDur(content.closing) : getDur(content.closing)
      const text = isDialogue(content.closing) ? renderDialogue(content.closing) : this.fmt(content.closing.text)
      sections.push(`**[收尾 · ${dur || 15}s]**\n${text}\n\n---\n`)
    }

    // 计算总时长
    const allDurations = []
    if (content.hook) allDurations.push(isDialogue(content.hook) ? dialogueDur(content.hook) : getDur(content.hook))
    if (content.overview) allDurations.push(isDialogue(content.overview) ? dialogueDur(content.overview) : getDur(content.overview))
    for (const i of deepItems) allDurations.push(i.dialogue ? dialogueDur(i.dialogue) : getDur(i))
    for (const i of quickItems) allDurations.push(i.dialogue ? dialogueDur(i.dialogue) : getDur(i))
    if (content.closing) allDurations.push(isDialogue(content.closing) ? dialogueDur(content.closing) : getDur(content.closing))
    const totalSeconds = allDurations.reduce((a, b) => a + b, 0)
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
