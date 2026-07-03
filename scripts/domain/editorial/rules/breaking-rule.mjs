/**
 * BreakingRule — 确定性 Breaking News 保底机制
 *
 * 触发条件（满足任一）：
 * 1. top_tier 实体 + 该实体当天出现 ≤ 2 次
 * 2. 官方 Blog 来源 + cluster_size = 1
 * 3. event_type ∈ {model_release, acquisition} + score ≥ 55
 *
 * 纯计算，不调 LLM。
 */

import { createFilterSignal } from '../signal.mjs'
import { ENTITY_WEIGHTS, SCORING } from '../../../config.mjs'

const OFFICIAL_BLOG_SOURCES = new Set([
  'openai.com', 'anthropic.com', 'ai.meta.com', 'blogs.nvidia.com',
  'blog.google', 'mistral.ai', 'deepmind.google',
])

function getEntityCounts(events) {
  const counts = new Map()
  for (const event of events) {
    const entities = event.entities || []
    for (const e of entities) {
      counts.set(e, (counts.get(e) || 0) + 1)
    }
  }
  return counts
}

function hasTopTierEntity(event) {
  const entities = event.entities || []
  const topTier = ENTITY_WEIGHTS.top_tier?.entities || []
  return entities.find((e) => topTier.includes(e)) || null
}

function isOfficialBlog(sourceName, sourceUrl) {
  if (!sourceName && !sourceUrl) return false
  const host = (sourceUrl || '').replace(/^https?:\/\//, '').split('/')[0] || ''
  for (const blog of OFFICIAL_BLOG_SOURCES) {
    if (host.includes(blog) || (sourceName && sourceName.toLowerCase().includes(blog.split('.')[0]))) {
      return true
    }
  }
  return false
}

export class BreakingRule {
  evaluate(events) {
    const signals = []
    const entityCounts = getEntityCounts(events)

    for (const event of events) {
      const eventId = event.id
      if (!eventId) continue

      // 条件 1: top_tier 实体 + 低频率
      const topEntity = hasTopTierEntity(event)
      if (topEntity) {
        const count = entityCounts.get(topEntity) || 0
        if (count <= 2) {
          signals.push(createFilterSignal(
            'BREAKING', 'BreakingRule',
            `top_tier entity "${topEntity}" appears only ${count} time(s) today`,
            { eventId, entity: topEntity }
          ))
          continue
        }
      }

      // 条件 2: 官方 Blog + singleton cluster
      const clusterSize = event.metadata?.clusterSize || event.cluster_size || 1
      const sourceUrl = event.source?.url || event.url || ''
      const sourceName = event.source?.name || event.source_name || ''
      if (isOfficialBlog(sourceName, sourceUrl) && clusterSize <= 1) {
        signals.push(createFilterSignal(
          'BREAKING', 'BreakingRule',
          `official blog source "${sourceName}" with singleton cluster`,
          { eventId }
        ))
        continue
      }

      // 条件 3: 重要事件类型 + 足够评分
      const reviewMin = SCORING?.thresholds?.review_min || 55
      const eventType = event.eventType || event.event_type || event.metadata?.eventType || ''
      const score = event.rank?.totalScore ?? event.rank_total ?? 0
      if ((eventType === 'model_release' || eventType === 'acquisition') && score >= reviewMin) {
        signals.push(createFilterSignal(
          'BREAKING', 'BreakingRule',
          `event_type "${eventType}" with score ${score} >= review threshold ${reviewMin}`,
          { eventId }
        ))
      }
    }

    return { signals }
  }
}
