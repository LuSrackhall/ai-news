/**
 * MemoryDedupRule — 跨天去重
 *
 * 在 JudgmentEngine 的 Qualification 阶段查询 Memory，
 * 检测事件是否已在近期报道中覆盖。
 *
 * 匹配策略（优先级）：
 * 1. cluster_id 匹配 — 同一事件集群在 3 天内已报道
 * 2. entity 匹配 — 首实体在 Memory 中连续 3 天出现（降级回退）
 *
 * 输出信号：
 * - FOLLOW_UP (RANK phase，可配置 weight，默认 -10)
 * - STALE (contextual rejection，可被 BREAKING 覆盖)
 *
 * Architecture Editorial Intelligence v2 约束：
 * - Memory is advisory（STALE 拒绝可被 BREAKING 覆盖）
 */

import { createRankSignal, createFilterSignal } from '../signal.mjs'
import { SIGNAL_WEIGHTS } from '../../../config.mjs'

const DEFAULT_FOLLOW_UP_WEIGHT = -10

export class MemoryDedupRule {
  constructor() {
    this._followUpWeight = SIGNAL_WEIGHTS?.follow_up ?? DEFAULT_FOLLOW_UP_WEIGHT
  }

  evaluate(events, context) {
    const signals = []
    const memoryStore = context?.memoryStore || context?.memory
    if (!memoryStore) return { signals } // Cold start: Memory 不可用时静默跳过

    const date = context?.date || new Date().toISOString().slice(0, 10)
    const threeDaysAgo = new Date(new Date(date).getTime() - 3 * 86400000).toISOString().slice(0, 10)

    for (const event of events) {
      const eventId = event.id
      if (!eventId) continue

      const clusterId = event.cluster_id || event.clusterId || null
      const entities = event.entities || []

      // 策略 1: cluster_id 匹配（优先）
      let matchedStory = null
      if (clusterId) {
        const story = memoryStore.queryStory(clusterId)
        if (story && story.story) {
          matchedStory = story.story
        }
      }

      // 策略 2: entity 匹配（降级）
      if (!matchedStory && entities.length > 0) {
        for (const entity of entities) {
          const stories = memoryStore.queryStoriesByEntity(entity)
          if (stories.length > 0) {
            matchedStory = stories[0]
            break
          }
        }
      }

      if (!matchedStory) continue

      const lastSeen = matchedStory.last_seen || ''
      const state = matchedStory.state || ''

      // STALE: Memory 标记为 stale → contextual rejection（可被 BREAKING 覆盖）
      if (state === 'stale') {
        signals.push(createFilterSignal(
          'STALE', 'MemoryDedupRule',
          `story "${matchedStory.story_key}" is stale, event #${eventId}`,
          { eventId, storyKey: matchedStory.story_key }
        ))
        continue
      }

      // FOLLOW_UP: 3 天内已覆盖 → RANK 负权重
      if (lastSeen >= threeDaysAgo) {
        signals.push(createRankSignal(
          'FOLLOW_UP', this._followUpWeight, 'MemoryDedupRule',
          `event #${eventId} follows up on story "${matchedStory.story_key}" (last seen ${lastSeen})`,
          { eventId, storyKey: matchedStory.story_key, lastSeen }
        ))
      }
    }

    return { signals }
  }
}
