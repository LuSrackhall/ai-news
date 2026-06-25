/**
 * StoreEvents Task — INSERT OR IGNORE 写入 SQLite + event_entities + event_topics
 */

import { ExecutionResult } from '../runtime/result.mjs'

export class StoreEvents {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const assets = ctx._assets || []
    const repo = ctx.scope.events.repository

    // 转换为 Event 格式
    const events = assets.map(asset => ({
      id: asset.id,
      type: asset.type || 'news',
      title: asset.title,
      summary: asset.summary,
      url: asset.url,
      contentHash: asset.contentHash,
      publishedAt: asset.publishedAt,
      collectedAt: asset.collectedAt,
      effectiveAt: asset.effectiveAt,
      timePrecision: asset.timePrecision,
      rank: asset.rank || null,
      source: asset.source,
      sourceId: asset.sourceId,
      entities: asset.entities || [],
      topics: asset.topics || [],
      assetIds: [asset.id],
      metadata: asset.metadata || {},
    }))

    const inserted = repo.storeBatch(events)

    return ExecutionResult.ok(
      { stored: inserted },
      { input: events.length, inserted, skipped: events.length - inserted }
    )
  }
}
