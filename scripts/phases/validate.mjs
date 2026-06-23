/**
 * ValidatePhase — 校验
 * 调 ctx.domain.validate.run()，返回 PhaseResult 含校验结果
 */

import { PhaseResult } from '../engine/phase-result.mjs'

export class ValidatePhase {
  name = '校验'

  async run(ctx) {
    const events = await ctx.stores.events.load()
    const curatedEvents = events.filter(e => e.curation)
    const articleArtifact = await ctx.stores.artifacts.load('article')
    const scriptArtifact = await ctx.stores.artifacts.load('script')

    const validation = ctx.domain.validate.run(articleArtifact, scriptArtifact, curatedEvents)

    ctx.services.metrics.record(this.name, 'article_passed', validation.articlePassed)
    ctx.services.metrics.record(this.name, 'script_passed', validation.scriptPassed)
    ctx.services.metrics.record(this.name, 'content_passed', validation.contentPassed)
    ctx.services.metrics.record(this.name, 'consistency', validation.consistency)

    const warnings = []
    if (!validation.validation_passed) {
      warnings.push(`校验未通过: ${JSON.stringify(validation.details?.content?.summary || {})}`)
    }

    return PhaseResult.ok({
      article_passed: validation.articlePassed,
      script_passed: validation.scriptPassed,
      content_passed: validation.contentPassed,
      consistency: validation.consistency,
      validation_passed: validation.validation_passed,
    })
  }
}
