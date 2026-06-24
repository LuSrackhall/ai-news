/**
 * RenderArtifacts Task — 渲染
 * readModel.load → policyEngine.execute('render') → artifactRepository.store rendered
 */

import { ExecutionResult } from '../runtime/result.mjs'

export class RenderArtifacts {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const events = ctx.scope.events.readModel.load()
    const curatedEvents = events.filter(e => e.curation)
    const sourcesUsed = [...new Set(curatedEvents.map(e => e.sources?.[0]?.name).filter(Boolean))]

    const articleArtifact = ctx.scope.artifacts.readModel.load('article')
    const scriptArtifact = ctx.scope.artifacts.readModel.load('script')

    const articleMd = ctx.scope.policyEngine.execute('render', {
      type: 'article',
      content: articleArtifact?.content || {},
      date: ctx.resources.date,
      sources: sourcesUsed,
      stats: { selected: curatedEvents.length },
    })

    const scriptMd = ctx.scope.policyEngine.execute('render', {
      type: 'script',
      content: scriptArtifact?.content || {},
      date: ctx.resources.date,
    })

    // 更新 rendered 层
    ctx.scope.artifacts.repository.store('article', { ...articleArtifact, rendered: { markdown: articleMd, html: null } })
    ctx.scope.artifacts.repository.store('script', { ...scriptArtifact, rendered: { markdown: scriptMd, subtitles: null } })

    return ExecutionResult.ok({}, { article_chars: articleMd.length, script_chars: scriptMd.length })
  }
}
