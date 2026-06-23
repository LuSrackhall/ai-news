/**
 * ScorePhase — 评分与分级
 * 调 ctx.domain.ranking.buildEvents()，写入 ctx.stores.events
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PhaseResult } from '../engine/phase-result.mjs'

export class ScorePhase {
  name = '评分'

  async run(ctx) {
    const outputPath = join(ctx.environment.workspace, ctx.environment.config.outputDir, ctx.environment.date, 'raw')
    let validItems
    try {
      validItems = JSON.parse(readFileSync(join(outputPath, 'valid-raw.json'), 'utf-8'))
    } catch {
      validItems = JSON.parse(readFileSync(join(outputPath, 'all-raw.json'), 'utf-8'))
    }

    const scored = ctx.domain.ranking.scoreAll(validItems)
    const { auto, review, skip } = ctx.domain.ranking.classify(scored)
    const events = ctx.domain.ranking.buildEvents(scored)

    ctx.stores.events.save(events)

    ctx.services.metrics.record(this.name, 'total', scored.length)
    ctx.services.metrics.record(this.name, 'auto', auto.length)
    ctx.services.metrics.record(this.name, 'review', review.length)

    return PhaseResult.ok({
      input: scored.length,
      auto: auto.length,
      review: review.length,
      skip: skip.length,
    })
  }
}
