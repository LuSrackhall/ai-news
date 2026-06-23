/**
 * CuratePhase — LLM 选题
 * 调 ctx.domain.curation.select()，写回 ctx.stores.events
 */

import { PhaseResult } from '../engine/phase-result.mjs'

export class CuratePhase {
  name = 'LLM 选题'

  async run(ctx) {
    const events = await ctx.stores.events.load()
    const { curatedEvents, summary, sourcesUsed } = await ctx.domain.curation.select(events)

    ctx.stores.events.save(curatedEvents)

    ctx.services.metrics.record(this.name, 'input', events.length)
    ctx.services.metrics.record(this.name, 'selected', curatedEvents.length)

    if (curatedEvents.length < 1) {
      return PhaseResult.fatal('no_curated_items')
    }

    return PhaseResult.ok({
      input: events.length,
      selected: curatedEvents.length,
      sources_used: sourcesUsed,
      summary,
    })
  }
}
