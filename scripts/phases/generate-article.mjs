/**
 * GenerateArticlePhase — 文章生成
 * 调 ctx.domain.generate.article()，写入 ctx.stores.artifacts
 */

import { PhaseResult } from '../engine/phase-result.mjs'

export class GenerateArticlePhase {
  name = '文章生成'

  async run(ctx) {
    const { content, meta } = await ctx.domain.generate.article()

    if (!content) {
      return PhaseResult.fatal('article_generation_failed')
    }

    ctx.stores.artifacts.save('article', {
      type: 'article',
      content,
      rendered: null,
      meta,
    })

    ctx.services.metrics.record(this.name, 'article_ok', true)
    ctx.services.metrics.record(this.name, 'retry_count', meta.retryCount)

    return PhaseResult.ok({
      article_ok: true,
      retry_count: meta.retryCount,
    })
  }
}
