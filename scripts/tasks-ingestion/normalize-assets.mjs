/**
 * NormalizeAssets Task — 统一字段 + 计算 effective_at + time_precision
 */

import { ExecutionResult } from '../runtime/result.mjs'
import { computeEffectiveTime } from '../domain/time-model.mjs'
import { computeAssetHash } from '../engine/schemas.mjs'

export class NormalizeAssets {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const assets = ctx._assets || []
    const now = new Date().toISOString()

    const normalized = assets.map(asset => {
      const publishedAt = asset.publishedAt || asset.published_at || null
      const collectedAt = asset.fetchedAt || asset.fetched_at || now
      const { effective_at, time_precision } = computeEffectiveTime(publishedAt, collectedAt)

      return {
        id: asset.id,
        type: asset.type || 'rss',
        title: asset.title || '',
        summary: asset.summary || asset.summary_zh || '',
        url: asset.url || null,
        contentHash: computeAssetHash(asset),

        publishedAt,
        collectedAt,
        effectiveAt: effective_at,
        timePrecision: time_precision,

        source: {
          name: asset.source_name || asset.sourceName || asset.source?.name || 'unknown',
          tier: asset.source_tier || asset.source?.tier || asset.tier || 3,
          url: asset.url || null,
        },
        sourceId: asset.sourceId || asset.source_id || asset.sourceId || null,

        category: asset.category || null,
        language: asset.language || 'en',
        metadata: {
          impactScore: asset.impactScore || asset.metadata?.impactScore || 0,
          urlVerified: false,
          deadLink: false,
        },
      }
    })

    ctx._assets = normalized

    return ExecutionResult.ok(
      { normalized: normalized.length },
      { input: assets.length, output: normalized.length }
    )
  }
}
