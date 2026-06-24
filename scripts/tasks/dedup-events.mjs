/**
 * DedupEvents Task — 去重
 * readModel.load + history(14) → policyEngine.execute('dedup') → repository.store
 */

import { ExecutionResult } from '../runtime/result.mjs'

export class DedupEvents {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const events = ctx.scope.events.readModel.load()
    const history = ctx.scope.events.readModel.history(14)

    const { kept, removed } = ctx.scope.policyEngine.execute('dedup', { today: events, history })

    // 只保留 auto 和 review
    const deduped = kept.filter(e => e.rank?.tierLabel === 'auto' || e.rank?.tierLabel === 'review')
    ctx.scope.events.repository.store(deduped)

    if (deduped.length < 1) return ExecutionResult.fatal('no_candidates')

    return ExecutionResult.ok(
      { candidates: deduped.length },
      { input: events.length, kept: deduped.length, removed: removed.length }
    )
  }
}
