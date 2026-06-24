/**
 * EntityWeightRule — 实体权重评分（Bonus）
 * 实体匹配 → bonus score
 */

import { ENTITY_WEIGHTS } from '../config.mjs'

export class EntityWeightRule {
  name = 'entityWeight'

  evaluate(asset) {
    const text = `${asset.title || ''} ${asset.description || ''} ${asset.summary || ''}`.toLowerCase()
    let maxScore = 0, matchCount = 0

    for (const tier of Object.values(ENTITY_WEIGHTS)) {
      if (!tier.entities) continue
      for (const entity of tier.entities) {
        if (text.includes(entity.toLowerCase())) {
          maxScore = Math.max(maxScore, tier.score)
          matchCount++
        }
      }
    }
    if (matchCount >= 2 && maxScore >= 10) maxScore += ENTITY_WEIGHTS.multi_entity_bonus
    return { type: 'bonus', score: Math.min(maxScore, 12) }
  }
}
