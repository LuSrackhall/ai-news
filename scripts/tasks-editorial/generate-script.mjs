/**
 * GenerateScript Task — LLM 口播稿生成
 */

import { ExecutionResult } from '../runtime/result.mjs'
import { computeHash } from '../engine/schemas.mjs'

export class GenerateScript {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const curatedEvents = ctx._curatedEvents || []
    const eventsJson = JSON.stringify(curatedEvents, null, 2)
    const articleContent = ctx._articleContent || {}
    const articleJsonStr = JSON.stringify(articleContent, null, 2)

    const content = await ctx.scope.inference.run('script', {
      news_data: eventsJson.slice(0, 10000),
      article_data: articleJsonStr.slice(0, 8000),
    })

    if (!content) return ExecutionResult.fatal('script_generation_failed')

    const getDur = (s) => s?.durationS || s?.duration_s || 0
    const totalDuration = [
      getDur(content.hook), getDur(content.overview),
      ...(content.deepItems || content.deep_items || []).map(getDur),
      ...(content.quickItems || content.quick_items || []).map(getDur),
      getDur(content.closing),
    ].reduce((a, b) => a + b, 0)

    ctx._scriptContent = content
    ctx._scriptMeta = {
      eventIds: curatedEvents.map(e => e.id),
      model: 'sonnet',
      promptVersion: 'v1',
      inputHash: computeHash(eventsJson.slice(0, 10000)),
      totalDurationS: totalDuration,
    }

    return ExecutionResult.ok({ script_ok: true }, { total_duration_s: totalDuration })
  }
}
