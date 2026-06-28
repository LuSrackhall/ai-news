/**
 * GenerateScript Task — 播客脚本生成
 */

import { ExecutionResult } from '../runtime/result.mjs'
import { createHash } from 'node:crypto'

export class GenerateScript {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const events = ctx.scope.events.readModel.load()
    const curatedEvents = events.filter(e => e.curation)
    const eventsJson = JSON.stringify(curatedEvents, null, 2)

    const articleArtifact = ctx.scope.artifacts.readModel.load('article')
    const articleContent = articleArtifact?.content || {}
    const articleJsonStr = JSON.stringify(articleContent, null, 2)

    const content = await ctx.scope.inference.run('script', {
      news_data: eventsJson.slice(0, 10000),
      article_data: articleJsonStr.slice(0, 8000),
    })

    if (!content) return ExecutionResult.fatal('script_generation_failed')

    const inputHash = 'sha256:' + createHash('sha256').update(eventsJson.slice(0, 10000)).digest('hex').slice(0, 16)
    const getDur = (s) => s?.durationS || s?.duration_s || 0
    const totalDuration = [
      getDur(content.hook), getDur(content.overview),
      ...(content.deepItems || content.deep_items || []).map(getDur),
      ...(content.quickItems || content.quick_items || []).map(getDur),
      getDur(content.closing),
    ].reduce((a, b) => a + b, 0)

    ctx.scope.artifacts.repository.store('script', {
      type: 'script',
      content,
      rendered: null,
      meta: {
        generatedAt: new Date().toISOString(),
        model: 'sonnet',
        promptVersion: 'v1',
        eventIds: curatedEvents.map(e => e.id),
        inputHash,
        totalDurationS: totalDuration,
      },
    })

    return ExecutionResult.ok({ script_ok: true }, { total_duration_s: totalDuration })
  }
}
