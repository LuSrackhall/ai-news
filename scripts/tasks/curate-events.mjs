/**
 * CurateEvents Task — LLM 选题
 * readModel.load → inferenceService.run('curation') → repository.store
 */

import { ExecutionResult } from '../runtime/result.mjs'

export class CurateEvents {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const events = ctx.scope.events.readModel.load()
    const eventsJson = JSON.stringify(events, null, 2)

    const result = await ctx.scope.inference.run('curation', {
      input_data: eventsJson.slice(0, 20000),
    })

    if (!result || !result.selected_items) return ExecutionResult.fatal('no_curated_items')

    // 将选题结果附加到 Event 的 curation 快照
    const selectedMap = new Map()
    for (const item of result.selected_items) {
      selectedMap.set(item.id, { importance: item.importance, note: item.curation_note || null })
    }

    const curatedEvents = events
      .filter(e => selectedMap.has(e.id))
      .map(e => ({
        ...e,
        curation: selectedMap.get(e.id),
        timeline: { ...e.timeline, curated: new Date().toISOString() },
      }))

    ctx.scope.events.repository.store(curatedEvents)

    return ExecutionResult.ok(
      { selected: curatedEvents.length },
      { input: events.length, selected: curatedEvents.length, sources_used: result.curation_summary?.sources_used || [] }
    )
  }
}
