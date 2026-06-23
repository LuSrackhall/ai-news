/**
 * ArchivePhase — 归档
 * 读取 artifacts + events + execution，写磁盘文件，更新 index.json
 * Infrastructure / application glue，不属于核心 domain
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { PhaseResult } from '../engine/phase-result.mjs'
import { PIPELINE_VERSION } from '../config.mjs'

export class ArchivePhase {
  name = '归档'

  async run(ctx) {
    const date = ctx.environment.date
    const outputDir = join(ctx.environment.workspace, ctx.environment.config.outputDir, date)

    // 读取 artifacts
    const articleArtifact = await ctx.stores.artifacts.load('article')
    const scriptArtifact = await ctx.stores.artifacts.load('script')
    const events = await ctx.stores.events.load()
    const curatedEvents = events.filter(e => e.curation)

    const articleMarkdown = articleArtifact?.rendered?.markdown || ''
    const scriptMarkdown = scriptArtifact?.rendered?.markdown || ''
    const articleContent = articleArtifact?.content || articleArtifact || {}
    const scriptContent = scriptArtifact?.content || scriptArtifact || {}

    // 写入 Markdown 和 JSON 产物
    mkdirSync(outputDir, { recursive: true })
    writeFileSync(join(outputDir, 'article.md'), articleMarkdown)
    writeFileSync(join(outputDir, 'script.md'), scriptMarkdown)
    writeFileSync(join(outputDir, 'article.json'), JSON.stringify(articleContent, null, 2))
    writeFileSync(join(outputDir, 'script.json'), JSON.stringify(scriptContent, null, 2))

    // 更新 index.json
    const indexPath = join(ctx.environment.workspace, ctx.environment.config.outputDir, 'index.json')
    let index = { version: 1, entries: [] }
    try { index = JSON.parse(readFileSync(indexPath, 'utf-8')) } catch {}
    index.entries = index.entries.filter((e) => e.date !== date)
    index.entries.unshift({
      date,
      items: curatedEvents.map((event) => ({
        id: event.id,
        title: event.title,
        url: event.url,
        source: event.sources?.[0]?.name,
        importance: event.curation?.importance,
      })),
      selected_count: curatedEvents.length,
      pipeline_version: PIPELINE_VERSION,
    })
    index.entries = index.entries.slice(0, 30)
    index.updated_at = new Date().toISOString()
    writeFileSync(indexPath, JSON.stringify(index, null, 2))

    ctx.services.metrics.record(this.name, 'article_chars', articleMarkdown.length)
    ctx.services.metrics.record(this.name, 'script_chars', scriptMarkdown.length)
    ctx.services.metrics.record(this.name, 'index_entries', index.entries.length)

    return PhaseResult.ok({
      article_chars: articleMarkdown.length,
      script_chars: scriptMarkdown.length,
      index_entries: index.entries.length,
    })
  }
}
