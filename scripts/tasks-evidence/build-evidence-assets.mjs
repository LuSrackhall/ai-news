/**
 * BuildEvidenceAssets Task — 采集事件证据资产（截图 + 评分）
 *
 * 在 CurateEvents（选题）之后、GenerateArticle（文章生成）之前运行。
 * 对已选题事件，从源 URL 使用 Playwright 采集证据截图并评分。
 */

import { ExecutionResult } from '../runtime/result.mjs'
import { collectBatchEvidence } from '../evidence/collector.mjs'
import { scoreEvidence } from '../evidence/scorer.mjs'
import { createProvenanceService } from '../services/provenance-service.mjs'
import { readFileSync, writeFileSync } from 'node:fs'

/**
 * 从存储中重新加载 evidence 对象（用于后续评分更新）
 */
function loadEvidence(evidenceDir) {
  try {
    return JSON.parse(readFileSync(evidenceDir + '/evidence.json', 'utf-8'))
  } catch { return null }
}

export class BuildEvidenceAssets {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const curatedEvents = ctx._curatedEvents || []
    if (curatedEvents.length === 0) {
      ctx._evidenceAssets = []
      return ExecutionResult.ok({ evidence_count: 0 })
    }

    const db = ctx.scope?.events?.repository?._db || null
    const provenanceService = db ? createProvenanceService(db) : null
    const date = ctx.resources.date || new Date().toISOString().slice(0, 10)
    const outputBase = 'output/production/ai'

    const log = (msg) => console.log(`  ${msg}`)

    log(`证据采集: ${curatedEvents.length} 个事件`)

    // 采集证据
    const evidenceList = await collectBatchEvidence(curatedEvents, {
      outputBase,
      onProgress: log,
    })

    // 补充评分（SourceAuthority + ProvenanceCrosscheck）
    const enriched = []
    for (const ev of evidenceList) {
      if (!ev) continue

      const event = curatedEvents.find(e => e.id === ev.event_id)
      if (!event) { enriched.push(ev); continue }

      // 信源权威评分
      let trustScore = null
      let duplicateCount = 0
      const sourceId = event.sourceId || event.source?.name?.toLowerCase().replace(/\s+/g, '-') || ''
      if (provenanceService) {
        const publisher = provenanceService.resolvePublisher(sourceId)
        if (publisher) trustScore = publisher.trustScore

        // duplicate_of 边数
        const edges = provenanceService.getDuplicateEdges(event.id)
        duplicateCount = edges.length
      }

      // 重算评分
      const fullScoring = scoreEvidence(ev, { trustScore, duplicateCount })
      ev.scoring = fullScoring

      // 更新存储中的评分
      try {
        const evidenceDir = `${outputBase}/${date}/evidence/${event.id}`
        writeFileSync(evidenceDir + '/evidence.json', JSON.stringify(ev, null, 2))
      } catch {}

      enriched.push(ev)
    }

    ctx._evidenceAssets = enriched

    log(`证据完成: ${enriched.length}/${curatedEvents.length} 成功`)

    return ExecutionResult.ok(
      { evidence_count: enriched.length },
      { total: curatedEvents.length, success: enriched.length }
    )
  }
}
