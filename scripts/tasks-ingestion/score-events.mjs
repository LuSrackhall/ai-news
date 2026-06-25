/**
 * ScoreEvents Task — 调 policyEngine.execute('ranking')
 */

import { ExecutionResult } from '../runtime/result.mjs'

export class ScoreEvents {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const assets = ctx._assets || []
    const ranked = ctx.scope.policyEngine.execute('ranking', assets)

    const auto = ranked.filter(r => r.rank?.tierLabel === 'auto')
    const review = ranked.filter(r => r.rank?.tierLabel === 'review')

    ctx._assets = ranked

    return ExecutionResult.ok(
      { scored: ranked.length },
      { input: assets.length, auto: auto.length, review: review.length, skip: ranked.length - auto.length - review.length }
    )
  }
}
