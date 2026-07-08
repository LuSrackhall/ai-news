/**
 * ArchiveOutput Task — 归档
 * readModel.load → 写磁盘文件 → 更新 index.json
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

    const articleArtifact = ctx.scope.artifacts.readModel.load('article')
    const scriptArtifact = ctx.scope.artifacts.readModel.load('script')
    const events = ctx.scope.events.readModel.load()
    const curatedEvents = events.filter(e => e.curation)

    const articleMd = articleArtifact?.rendered?.markdown || ''
    const scriptMd = scriptArtifact?.rendered?.markdown || ''
    const articleContent = articleArtifact?.content || {}
    const scriptContent = scriptArtifact?.content || {}

    // 写产物文件
    writeFileSync(join(outputDir, 'article.md'), articleMd)
    writeFileSync(join(outputDir, 'script.md'), scriptMd)
    writeFileSync(join(outputDir, 'article.json'), JSON.stringify(articleContent, null, 2))
    writeFileSync(join(outputDir, 'script.json'), JSON.stringify(scriptContent, null, 2))

    // 更新 index.json
    const indexPath = join('.', 'output/production/ai', 'index.json')
    let index = { version: 1, entries: [] }
    try { index = JSON.parse(readFileSync(indexPath, 'utf-8')) } catch {}
    index.entries = index.entries.filter((e) => e.date !== date)
    index.entries.unshift({
      date,
      items: curatedEvents.map((e) => ({
        id: e.id, title: e.title, url: e.url,
        source: e.sources?.[0]?.name, importance: e.curation?.importance,
      })),
      selected_count: curatedEvents.length,
      pipeline_version: 'v4.1',
    })
    index.entries = index.entries.slice(0, 30)
    index.updated_at = new Date().toISOString()
    writeFileSync(indexPath, JSON.stringify(index, null, 2))

    return ExecutionResult.ok({}, {
      article_chars: articleMd.length,
      script_chars: scriptMd.length,
      index_entries: index.entries.length,
    })
  }
}
