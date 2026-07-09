/**
 * priority-signals.mjs — Prioritization 阶段的简化信号
 *
 * 从现有 RankingPolicy / config.mjs 的规则简化为独立信号，
 * 每个信号仅输出 RANK-phase signal（带 weight）。
 */

import { createRankSignal } from './signal.mjs'
import { SCORING, ENTITY_WEIGHTS } from '../../config.mjs'

/**
 * AuthoritySignal — 来源权威性分数
 * 从 RankingPolicy 的 authority base score 简化而来
 */
export class AuthoritySignal {
  evaluate(events) {
    const signals = []
    for (const event of events) {
      const eventId = event.id
      if (!eventId) continue
      const tier = event.source?.tier ?? event.source_tier ?? 3
      const tierScores = SCORING.base.authority.tier_scores
      const score = tierScores[tier] || tierScores[3]
      signals.push(createRankSignal('AUTHORITY', score, 'AuthoritySignal', `source tier ${tier} → score ${score}`, { eventId }))
    }
    return { signals }
  }
}

/**
 * FreshnessSignal — 时效性分数
 * 从 RankingPolicy 的 timeliness base score 简化而来
 */
export class FreshnessSignal {
  evaluate(events) {
    const signals = []
    for (const event of events) {
      const eventId = event.id
      if (!eventId) continue

      const publishedAt = event.publishedAt || event.published_at || event.sources?.[0]?.publishedAt
      let hoursOld = 999
      if (publishedAt) {
        hoursOld = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60)
      }

      const thresholds = SCORING.base.timeliness.thresholds
      let score = thresholds[thresholds.length - 1].score // 默认最低分
      for (const t of thresholds) {
        if (hoursOld <= t.maxHours) {
          score = t.score
          break
        }
      }

      signals.push(createRankSignal('FRESHNESS', score, 'FreshnessSignal',
        hoursOld < 999 ? `${hoursOld.toFixed(1)}h old → score ${score}` : 'no timestamp → min score',
        { eventId }))
    }
    return { signals }
  }
}

/**
 * EntityHeatSignal — 实体热度分数
 * 从 ENTITY_WEIGHTS 简化而来
 */
export class EntityHeatSignal {
  evaluate(events) {
    const signals = []
    for (const event of events) {
      const eventId = event.id
      if (!eventId) continue

      const entities = event.entities || []
      let maxScore = 0
      let matchedEntity = ''

      for (const tier of ['top_tier', 'second_tier', 'chinese_tech', 'notable']) {
        const cfg = ENTITY_WEIGHTS[tier]
        if (!cfg) continue
        for (const entity of (cfg.entities || [])) {
          if (entities.includes(entity)) {
            if (cfg.score > maxScore) {
              maxScore = cfg.score
              matchedEntity = entity
            }
          }
        }
      }

      if (maxScore > 0) {
        signals.push(createRankSignal('ENTITY_HEAT', maxScore, 'EntityHeatSignal',
          `entity "${matchedEntity}" → +${maxScore}`, { eventId, entity: matchedEntity }))
      }
    }
    return { signals }
  }
}

/**
 * SourceDiversitySignal — 来源多样性约束
 * 从 SCORING.source_caps 升级为信号形式
 * 注意：该信号需要事件集合上下文，因此 evaluate 检查 events 数组
 * 的输出是否符合来源多样性要求。对于超出 cap 的 source，
 * 产出负向 RANK signal。
 */
export class SourceDiversitySignal {
  constructor() {
    this._candidates = []
  }

  evaluate(events) {
    const signals = []
    if (!events || events.length === 0) return { signals }

    // 统计当前集合中各来源数量
    const sourceCounts = new Map()
    for (const event of events) {
      const sourceId = event.source?.name || event.source_name || event.sourceId || 'unknown'
      sourceCounts.set(sourceId, (sourceCounts.get(sourceId) || 0) + 1)
    }

    // 检查每个来源是否超过 cap
    for (const [sourceId, count] of sourceCounts) {
      const cap = SCORING.source_caps[sourceId] || SCORING.source_caps._default || 3
      if (count > cap) {
        // 超出 cap 的来源，其事件获得负向信号
        for (const event of events) {
          const sId = event.source?.name || event.source_name || event.sourceId || 'unknown'
          if (sId === sourceId) {
            signals.push(createRankSignal('SOURCE_DIVERSITY', -10, 'SourceDiversitySignal',
              `source "${sourceId}" exceeds cap (${count}/${cap})`, { eventId: event.id, sourceId }))
          }
        }
      }
    }

    return { signals }
  }
}

/**
 * OriginTierSignal — Provenance 发布方类型信任分信号
 *
 * 通过 ProvenanceService 查询 publisher_type 和 trust_score，
 * 为官方源/academic 源加分，为社区源降权。
 *
 * 需要 provenanceService 实例，在 execute-lanes.mjs 中注册：
 *   new OriginTierSignal(provenanceService)
 */
export class OriginTierSignal {
  constructor(provenanceService) {
    this._service = provenanceService
  }

  evaluate(events) {
    const signals = []
    if (!this._service) return { signals }

    for (const event of events) {
      const eventId = event.id
      if (!eventId) continue

      const sourceId = event.sourceId || ''
      const result = this._service.resolvePublisher(sourceId)
      if (!result) continue

      // publisher_type → weight 映射
      const typeWeights = {
        official: 15,     // OpenAI Blog, Anthropic, arXiv
        academic: 12,     // arXiv, Nature
        media: 5,         // TechCrunch, 36氪
        personal: 3,      // Simon Willison
        community: 0,     // LessWrong, Hacker News
      }
      const typeWeight = typeWeights[result.publisherType] || 0

      // trust_score → 额外加成（1-5 映射到 -5 到 +10）
      const trustBonus = Math.max(-5, Math.min(10, (result.trustScore - 3) * 5))

      if (typeWeight > 0 || trustBonus !== 0) {
        signals.push(createRankSignal(
          'ORIGIN_TIER', typeWeight + trustBonus, 'OriginTierSignal',
          `publisher: ${result.canonical} (${result.publisherType}, trust:${result.trustScore}) → +${typeWeight + trustBonus}`,
          { eventId, sourceId, publisherType: result.publisherType, trustScore: result.trustScore }
        ))
      }
    }
    return { signals }
  }
}
