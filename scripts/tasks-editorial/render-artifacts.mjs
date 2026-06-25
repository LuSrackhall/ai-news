/**
 * RenderArtifacts Task — policyEngine.execute('render')
 */

import { ExecutionResult } from '../runtime/result.mjs'

export class RenderArtifacts {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const curatedEvents = ctx._curatedEvents || []
    const sourcesUsed = [...new Set(curatedEvents.map(e => e.source?.name || e.sources?.[0]?.name).filter(Boolean))]

    const articleMd = ctx.scope.policyEngine.execute('render', {
      type: 'article',
      content: ctx._articleContent || {},
      date: ctx.resources.date,
      sources: sourcesUsed,
      stats: { selected: curatedEvents.length },
    })

    const scriptMd = ctx.scope.policyEngine.execute('render', {
      type: 'script',
      content: ctx._scriptContent || {},
      date: ctx.resources.date,
    })

    ctx._articleMarkdown = articleMd
    ctx._scriptMarkdown = scriptMd

    return ExecutionResult.ok({}, { article_chars: articleMd.length, script_chars: scriptMd.length })
  }
}
