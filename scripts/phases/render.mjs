/**
 * RenderPhase — 渲染
 * 调 ctx.domain.render.article/script()，写回 ctx.stores.artifacts 的 rendered 层
 */

import { PhaseResult } from '../engine/phase-result.mjs'

export class RenderPhase {
  name = '渲染'

  async run(ctx) {
    const events = await ctx.stores.events.load()
    const curatedEvents = events.filter(e => e.curation)
    const sourcesUsed = curatedEvents.map(e => e.sources?.[0]?.name).filter(Boolean)

    // 渲染文章
    const articleArtifact = await ctx.stores.artifacts.load('article')
    const articleContent = articleArtifact?.content || articleArtifact
    const articleMarkdown = ctx.domain.render.article(articleContent, {
      sources: sourcesUsed,
      stats: { selected: curatedEvents.length },
    })

    // 渲染口播稿
    const scriptArtifact = await ctx.stores.artifacts.load('script')
    const scriptContent = scriptArtifact?.content || scriptArtifact
    const scriptMarkdown = ctx.domain.render.script(scriptContent)

    // 更新 rendered 层
    ctx.stores.artifacts.save('article', {
      ...articleArtifact,
      rendered: { markdown: articleMarkdown, html: null },
    })
    ctx.stores.artifacts.save('script', {
      ...scriptArtifact,
      rendered: { markdown: scriptMarkdown, subtitles: null },
    })

    ctx.services.metrics.record(this.name, 'article_chars', articleMarkdown.length)
    ctx.services.metrics.record(this.name, 'script_chars', scriptMarkdown.length)

    return PhaseResult.ok({
      article_chars: articleMarkdown.length,
      script_chars: scriptMarkdown.length,
    })
  }
}
