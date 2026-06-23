/**
 * GenerateScriptPhase — 口播稿生成
 * 调 ctx.domain.generate.script()，写入 ctx.stores.artifacts
 */

import { PhaseResult } from '../engine/phase-result.mjs'

export class GenerateScriptPhase {
  name = '口播稿生成'

  async run(ctx) {
    const articleArtifact = await ctx.stores.artifacts.load('article')
    const articleContent = articleArtifact?.content || articleArtifact

    const { content, meta } = await ctx.domain.generate.script(articleContent)

    if (!content) {
      return PhaseResult.fatal('script_generation_failed')
    }

    ctx.stores.artifacts.save('script', {
      type: 'script',
      content,
      rendered: null,
      meta,
    })

    ctx.services.metrics.record(this.name, 'script_ok', true)
    ctx.services.metrics.record(this.name, 'total_duration_s', meta.totalDurationS)

    return PhaseResult.ok({
      script_ok: true,
      total_duration_s: meta.totalDurationS,
    })
  }
}
