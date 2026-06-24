/**
 * AuthorityRule — 权威性评分（Base）
 * tier → score
 */

import { SCORING } from '../config.mjs'

export class AuthorityRule {
  name = 'authority'

  evaluate(asset) {
    const tier = asset.source?.tier || asset.tier || 3
    const score = SCORING.base.authority.tier_scores[tier] || 0
    return { type: 'base', score: Math.min(score, 20) }
  }
}
