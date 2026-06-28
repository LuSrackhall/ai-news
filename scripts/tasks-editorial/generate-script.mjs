/**
 * GenerateScript Task — LLM 口播稿生成（面向播客）
 * 环境变量 GENERATE_SCRIPT=false 可禁用
 */

import { ExecutionResult } from '../runtime/result.mjs'
import { computeHash } from '../domain/hash.mjs'

export class GenerateScript {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    // 环境变量控制：GENERATE_SCRIPT=false 跳过口播稿生成
    if (process.env.GENERATE_SCRIPT === 'false') {
      ctx._scriptContent = {}
      ctx._scriptMeta = { skipped: true, reason: 'GENERATE_SCRIPT=false' }
      return ExecutionResult.ok({ script_skipped: true }, { total_duration_s: 0 })
    }

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
    const isDialogue = (item) => Array.isArray(item)
    const dialogueDur = (lines) => Array.isArray(lines) ? lines.reduce((s, l) => s + getDur(l), 0) : 0
    const itemDur = (item) => item.dialogue ? dialogueDur(item.dialogue) : getDur(item)

    const allDurations = []
    if (content.hook) allDurations.push(isDialogue(content.hook) ? dialogueDur(content.hook) : getDur(content.hook))
    if (content.overview) allDurations.push(isDialogue(content.overview) ? dialogueDur(content.overview) : getDur(content.overview))
    for (const i of (content.deepItems || content.deep_items || [])) allDurations.push(itemDur(i))
    for (const i of (content.quickItems || content.quick_items || [])) allDurations.push(itemDur(i))
    if (content.closing) allDurations.push(isDialogue(content.closing) ? dialogueDur(content.closing) : getDur(content.closing))
    const totalDuration = allDurations.reduce((a, b) => a + b, 0)

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
