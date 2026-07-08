/**
 * ArchiveOutput Task — 写 output/<date>/ 文件 + 更新 index.json
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { ExecutionResult } from '../runtime/result.mjs'

export class ArchiveOutput {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const date = ctx.resources.date
    const outputDir = join('.', 'output/production/ai', date)
    mkdirSync(outputDir, { recursive: true })

    const curatedEvents = ctx._curatedEvents || []

    writeFileSync(join(outputDir, 'article.md'), ctx._articleMarkdown || '')
    writeFileSync(join(outputDir, 'script.md'), ctx._scriptMarkdown || '')
    writeFileSync(join(outputDir, 'article.json'), JSON.stringify(ctx._articleContent || {}, null, 2))
    writeFileSync(join(outputDir, 'script.json'), JSON.stringify(ctx._scriptContent || {}, null, 2))
    writeFileSync(join(outputDir, 'curated.json'), JSON.stringify({
      date, pipeline_version: 'v4.2', selected_items: curatedEvents,
    }, null, 2))
    writeFileSync(join(outputDir, 'execution.json'), JSON.stringify({
      id: ctx.resources.runId, date, pipelineVersion: 'v4.2', status: 'success',
    }, null, 2))

    // 更新 index.json
    const indexPath = join('.', 'output/production/ai', 'index.json')
    let index = { version: 1, entries: [] }
    try { index = JSON.parse(readFileSync(indexPath, 'utf-8')) } catch {}
    index.entries = index.entries.filter(e => e.date !== date)
    index.entries.unshift({
      date,
      items: curatedEvents.map(e => ({
        id: e.id, title: e.title, url: e.url,
        source: e.source?.name || e.sources?.[0]?.name, importance: e.curation?.importance,
      })),
      selected_count: curatedEvents.length,
      pipeline_version: 'v4.2',
    })
    index.entries = index.entries.slice(0, 30)
    writeFileSync(indexPath, JSON.stringify(index, null, 2))

    return ExecutionResult.ok({}, {
      article_chars: (ctx._articleMarkdown || '').length,
      script_chars: (ctx._scriptMarkdown || '').length,
      index_entries: index.entries.length,
    })
  }
}
