/**
 * EditorialMemoryRule — 跨天报道记忆
 *
 * 规则：
 * - 查询 memoryStore 最近 7 天历史
 * - entity 或 cluster_id 命中 → MEMORY Signal
 * - 连续 2+ 天出现 → 附加 contextHint
 * - 纯 ANNOTATION，不影响 ranking
 *
 * 纯计算，不调 LLM。
 */

import { createAnnotationSignal } from '../signal.mjs'

export class EditorialMemoryRule {
  constructor(memoryStore) {
    this._memoryStore = memoryStore
  }

  evaluate(events, context) {
    const signals = []

    const date = context?.date || new Date().toISOString().slice(0, 10)
    const sevenDaysAgo = new Date(new Date(date).getTime() - 7 * 86400000).toISOString().slice(0, 10)
    const memory = this._memoryStore?.load(sevenDaysAgo) || { days: {} }

    // 构建历史 entity 出现统计
    const entityRecentDays = {}
    const recentEventIds = new Set()

    for (const [, snapshot] of Object.entries(memory.days || {})) {
      for (const entity of (snapshot.topEntities || [])) {
        entityRecentDays[entity] = (entityRecentDays[entity] || 0) + 1
      }
      for (const eventId of (snapshot.topEventIds || [])) {
        recentEventIds.add(eventId)
      }
    }

    for (const event of events) {
      const eventId = event.id
      if (!eventId) continue

      const entities = event.entities || []
      const clusterId = event.cluster_id || event.clusterId || null

      // 检查 entity 命中
      let matchedEntity = null
      let maxDays = 0
      for (const entity of entities) {
        const days = entityRecentDays[entity] || 0
        if (days > maxDays) {
          maxDays = days
          matchedEntity = entity
        }
      }

      // 检查 cluster_id 命中
      const clusterHit = clusterId && recentEventIds.has(eventId)

      if (matchedEntity && maxDays > 0) {
        const metadata = { eventId, entity: matchedEntity, recentDays: maxDays }
        signals.push(createAnnotationSignal(
          'MEMORY', 'EditorialMemoryRule',
          `entity "${matchedEntity}" appeared in ${maxDays} of last 7 days`,
          metadata
        ))
      } else if (clusterHit) {
        signals.push(createAnnotationSignal(
          'MEMORY', 'EditorialMemoryRule',
          `cluster "${clusterId}" has recent coverage`,
          { eventId, recentDays: 1 }
        ))
      }
    }

    return { signals }
  }
}
