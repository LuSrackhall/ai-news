/**
 * RenderArtifacts Task — policyEngine.execute('render')
 */

import { ExecutionResult } from '../runtime/result.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export class RenderArtifacts {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const curatedEvents = ctx._curatedEvents || []
    const sourcesUsed = [...new Set(curatedEvents.map(e => e.source?.name || e.sources?.[0]?.name).filter(Boolean))]

    const articleContent = ctx._articleContent || {}

    // 注入证据资产到 deep_items / important_items
    const date = ctx.resources.date
    const evidenceBase = join('.', 'output/production/ai', date, 'evidence')

    if (existsSync(evidenceBase)) {
      const { readdirSync, readFileSync: readF } = await import('node:fs')

      const injectEvidence = (items) => {
        if (!items) return
        for (const item of items) {
          // 根据 event_id 或 id 查找对应证据目录
          const eventId = item.id || ''
          const evDir = join(evidenceBase, eventId)
          if (!existsSync(evDir)) continue
          try {
            const evMeta = JSON.parse(readF(join(evDir, 'evidence.json'), 'utf-8'))
            const screenshotPath = `evidence/${eventId}/screenshot.png`
            const pngExists = existsSync(join(evDir, 'screenshot.png'))
            if (pngExists && evMeta) {
              item.evidence = [{
                type: 'screenshot',
                path: screenshotPath,
                caption: evMeta.claim?.text?.slice(0, 100) || '',
                confidence: evMeta.scoring?.overall || 0,
              }]
            }
          } catch {}
        }
      }

      // 为所有有 id 的 item 注入证据
      injectEvidence(articleContent.deep_items)
      injectEvidence(articleContent.important_items)
      injectEvidence(articleContent.brief_items)
    }

    const articleMd = ctx.scope.policyEngine.execute('render', {
      type: 'article',
      content: articleContent,
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
