/**
 * TimelinessRule — 时效性评分（Base）
 * age → score
 */

import { SCORING } from '../config.mjs'

export class TimelinessRule {
  name = 'timeliness'

  evaluate(asset) {
    const publishedAt = asset.publishedAt || asset.published_at
    if (!publishedAt) return { type: 'base', score: 2 }
    const ageHours = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60)
    let score = 2
    for (const t of SCORING.base.timeliness.thresholds) {
      if (ageHours <= t.maxHours) { score = t.score; break }
    }
    if (asset.dateReliability === 'low') score = Math.floor(score / 2)
    return { type: 'base', score }
  }
}
