/**
 * RenderWeekly Task — 渲染周报 Markdown
 */

import { ExecutionResult } from '../runtime/result.mjs'

export class RenderWeekly {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const clusters = ctx._clusters || []
    const weekRange = ctx._weekRange || {}
    const article = ctx._weeklyArticle || null

    const startDate = weekRange.from?.slice(0, 10) || ''
    const endDate = weekRange.to?.slice(0, 10) || ''

    // 渲染 article.md
    const articleMd = article || this.renderDefaultArticle(clusters, startDate, endDate)

    // 渲染 script.md（播客脚本骨架）
    const scriptMd = this.renderScript(clusters, startDate, endDate)

    ctx._rendered = { article: articleMd, script: scriptMd }

    return ExecutionResult.ok(
      { article_chars: articleMd.length, script_chars: scriptMd.length },
      { article_chars: articleMd.length, script_chars: scriptMd.length }
    )
  }

  renderDefaultArticle(clusters, startDate, endDate) {
    const lines = [
      `# AI 周报 ${startDate} ~ ${endDate}`,
      '',
      `本周共收录 ${clusters.reduce((s, c) => s + c.eventCount, 0)} 条事件，聚类为 ${clusters.length} 个主题。`,
      '',
    ]

    for (const cluster of clusters.slice(0, 10)) {
      lines.push(`## ${cluster.title}`)
      lines.push(`> 重要性: ${cluster.importance} | 事件数: ${cluster.eventCount}`)
      lines.push('')
      for (const event of cluster.events.slice(0, 3)) {
        const score = event.rank?.totalScore ? ` [${event.rank.totalScore}]` : ''
        const url = event.url ? ` — [链接](${event.url})` : ''
        lines.push(`- **${event.title}**${score}${url}`)
      }
      lines.push('')
    }

    return lines.join('\n')
  }

  renderScript(clusters, startDate, endDate) {
    const lines = [
      `# AI 周报播客脚本 ${startDate} ~ ${endDate}`,
      '',
      '## 开场白',
      '',
      `大家好，欢迎收听本周的 AI 日报周报。本期覆盖 ${startDate} 到 ${endDate}，共 ${clusters.length} 个热点话题。`,
      '',
    ]

    for (const cluster of clusters.slice(0, 5)) {
      lines.push(`## ${cluster.title}`)
      lines.push('')
      lines.push(`[请补充 ${cluster.title} 的播客解读]`)
      lines.push(`事件来源: ${cluster.events[0]?.title || '-'}`)
      lines.push('')
    }

    lines.push('## 总结')
    lines.push('')
    lines.push('[请补充本周总结]')

    return lines.join('\n')
  }
}
