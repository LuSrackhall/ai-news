/**
 * GenerateWeeklyArticle Task — LLM 生成周报文章
 */

import { ExecutionResult } from '../runtime/result.mjs'

export class GenerateWeeklyArticle {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const clusters = ctx._clusters || []
    const weekRange = ctx._weekRange || {}
    const inference = ctx.scope?.inference

    if (!inference) {
      return ExecutionResult.skipped('No inference service configured')
    }

    // 构建聚类摘要供 LLM 使用
    const clusterSummaries = clusters.slice(0, 10).map((c, i) => {
      const top3 = c.events.slice(0, 3).map(e =>
        `  - ${e.title} (评分: ${e.rank?.totalScore || '-'})`
      ).join('\n')
      return `### ${i + 1}. ${c.title} [${c.importance}] (${c.eventCount} 条)\n${top3}`
    }).join('\n\n')

    const vars = {
      week_start: weekRange.from?.slice(0, 10) || '',
      week_end: weekRange.to?.slice(0, 10) || '',
      cluster_count: clusters.length,
      event_count: clusters.reduce((sum, c) => sum + c.eventCount, 0),
      cluster_summaries: clusterSummaries,
    }

    try {
      const result = await inference.run('weekly-article', vars)
      ctx._weeklyArticle = result
      return ExecutionResult.ok(
        { article: result },
        { chars: result.length, clusters_used: Math.min(clusters.length, 10) }
      )
    } catch (err) {
      // LLM 失败不中断 Pipeline
      ctx._weeklyArticle = null
      return ExecutionResult.warn(
        { error: err.message },
        { fallback: true }
      )
    }
  }
}
