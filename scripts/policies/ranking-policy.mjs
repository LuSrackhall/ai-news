/**
 * RankingPolicy — 评分与分级
 * 组合多个 Rule，返回 ranked assets
 */

import { SCORING } from '../config.mjs'

export class RankingPolicy {
  constructor(rules) {
    this.rules = rules
  }

  execute(assets) {
    const scored = assets.map(asset => this.scoreOne(asset, assets))

    // 48h 年龄门禁
    for (const item of scored) {
      if (item.publishedAt) {
        const ageHours = (Date.now() - new Date(item.publishedAt).getTime()) / (1000 * 60 * 60)
        if (ageHours > 48) {
          item.rank.tierLabel = 'skip'
          item.rank._ageFiltered = true
        }
      }
    }

    // 按总分降序
    scored.sort((a, b) => b.rank.totalScore - a.rank.totalScore)

    // 同源上限
    const sourceCounts = {}
    for (const item of scored) {
      const sourceId = item.sourceId || item.source?.name || 'unknown'
      const cap = SCORING.source_caps[sourceId] || SCORING.source_caps._default
      if (!sourceCounts[sourceId]) sourceCounts[sourceId] = 0
      if (item.rank.tierLabel === 'auto' || item.rank.tierLabel === 'review') {
        sourceCounts[sourceId]++
        if (sourceCounts[sourceId] > cap) item.rank.tierLabel = 'skip'
      }
    }

    return scored
  }

  scoreOne(asset, allItems) {
    let baseScore = 0, bonusScore = 0
    const factors = {}

    for (const rule of this.rules) {
      const result = rule.evaluate(asset)
      if (result.type === 'base') { baseScore += result.score; factors[rule.name] = result.score }
      if (result.type === 'bonus') { bonusScore += result.score; factors[rule.name] = result.score }
    }

    const totalScore = Math.min(baseScore + bonusScore, 100)
    const tierLabel = totalScore >= SCORING.thresholds.auto ? 'auto'
      : totalScore >= SCORING.thresholds.review_min ? 'review' : 'skip'

    return {
      ...asset,
      rank: { baseScore, bonusScore, totalScore, tierLabel, factors },
    }
  }

  buildEvents(rankedAssets) {
    return rankedAssets.map(asset => ({
      id: asset.id,
      type: 'news',
      title: asset.title,
      summary: asset.summary || asset.summary_zh || '',
      url: asset.url,
      sources: [{
        name: asset.source?.name || asset.source_name || 'unknown',
        tier: asset.source?.tier || asset.tier || 3,
        url: asset.url,
        publishedAt: asset.publishedAt || asset.published_at,
      }],
      assetIds: [asset.id],
      clusterId: null,
      contentHash: asset.contentHash || null,
      rank: asset.rank,
      curation: null,
      entities: [],
      topics: [],
      relatedEventIds: [],
      timeline: {
        collected: asset.fetchedAt || new Date().toISOString(),
        verified: asset.verifiedAt || null,
        curated: null,
        generated: null,
      },
      metadata: { category: asset.category || null, sourceId: asset.sourceId || null },
    }))
  }
}
