/**
 * ArchiveWeekly Task — 写入 output/weekly/<week>/ + weekly_reports 表
 */

import { join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
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

    // 构建 manifest
    const articleChars = (rendered.article || '').length
    const scriptChars = (rendered.script || '').length
    const eventCount = clusters.reduce((s, c) => s + c.eventCount, 0)

    const manifest = {
      week_start: startDate,
      week_end: endDate,
      cluster_count: clusters.length,
      event_count: eventCount,
      article_chars: articleChars,
      script_chars: scriptChars,
      created_at: new Date().toISOString(),
    }
    const manifestPath = join(weekDir, 'manifest.json')
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')

    // A4: 写入 weekly_reports 表
    const weeklyReportRepo = ctx.scope?.events?.weeklyReportRepository
    if (weeklyReportRepo) {
      weeklyReportRepo.store({
        id: `wr-${randomUUID().slice(0, 8)}`,
        week_start: startDate,
        week_end: endDate,
        cluster_count: clusters.length,
        event_count: eventCount,
        article_chars: articleChars,
        script_chars: scriptChars,
        created_at: manifest.created_at,
      })
    }

    ctx._archivePath = weekDir

    return ExecutionResult.ok(
      { path: weekDir },
      { files: 3, path: weekDir }
    )
  }
}
