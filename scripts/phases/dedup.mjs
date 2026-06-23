/**
 * DedupPhase — 去重
 * 调 ctx.domain.dedup.run()，写回 ctx.stores.events
 */

import { PhaseResult } from '../engine/phase-result.mjs'

export class DedupPhase {
  name = '去重'

  async run(ctx) {
    const events = await ctx.stores.events.load()
    const { kept, removed, historicalCount } = await ctx.domain.dedup.run(events)

    // 只保留 auto 和 review 的 Event
    const deduped = kept.filter(e => e.rank?.tierLabel === 'auto' || e.rank?.tierLabel === 'review')
    ctx.stores.events.save(deduped)

    ctx.services.metrics.record(this.name, 'input', events.length)
    ctx.services.metrics.record(this.name, 'kept', deduped.length)
    ctx.services.metrics.record(this.name, 'removed', removed.length)

    if (deduped.length < 1) {
      return PhaseResult.fatal('no_candidates')
    }

    return PhaseResult.ok({
      input: events.length,
      candidates: deduped.length,
      dedup_removed: removed.length,
      historical_count: historicalCount,
    })
  }
}
