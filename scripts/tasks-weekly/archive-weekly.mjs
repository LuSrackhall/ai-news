/**
 * ArchiveWeekly Task — 写入 output/weekly/<week>/
 */

import { join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { ExecutionResult } from '../runtime/result.mjs'

export class ArchiveWeekly {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const rendered = ctx._rendered || {}
    const weekRange = ctx._weekRange || {}
    const clusters = ctx._clusters || []

    const startDate = weekRange.from?.slice(0, 10) || new Date().toISOString().slice(0, 10)
    const endDate = weekRange.to?.slice(0, 10) || startDate

    const weekDir = join('.', 'output', 'weekly', `${startDate}_${endDate}`)
    mkdirSync(weekDir, { recursive: true })

    // 写入 article.md
    const articlePath = join(weekDir, 'article.md')
    writeFileSync(articlePath, rendered.article || '', 'utf8')

    // 写入 script.md
    const scriptPath = join(weekDir, 'script.md')
    writeFileSync(scriptPath, rendered.script || '', 'utf8')

    // 写入 manifest.json
    const manifest = {
      week_start: startDate,
      week_end: endDate,
      cluster_count: clusters.length,
      event_count: clusters.reduce((s, c) => s + c.eventCount, 0),
      article_chars: (rendered.article || '').length,
      script_chars: (rendered.script || '').length,
      created_at: new Date().toISOString(),
    }
    const manifestPath = join(weekDir, 'manifest.json')
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')

    ctx._archivePath = weekDir

    return ExecutionResult.ok(
      { path: weekDir },
      { files: 3, path: weekDir }
    )
  }
}
