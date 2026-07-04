/**
 * LaneDispatcher — 将 Events 按 editorialDomain 分发到对应 Lane
 *
 * Architecture Constitution v4.0 约束：
 * - Invariant 5: 确定性执行（相同输入必定相同输出）
 * - Invariant 7: 不包含业务规则
 *
 * 输入 Event[]，输出 LaneMap（Map<LaneId, Event[]>）。
 * 每个 Event 有且仅有一个主 Lane。不匹配的归入 fallback。
 */

import { DEFAULT_LANE_CONFIGS } from './lane-types.mjs'

export class LaneDispatcher {
  /**
   * 分发 Events 到对应 Lane
   * @param {Object[]} events — Event 数组
   * @param {Object} [laneConfigs] — LaneId → LaneConfig，默认使用 DEFAULT_LANE_CONFIGS
   * @returns {Map<LaneId, Object[]>} LaneId → Event[]
   */
  dispatch(events, laneConfigs = DEFAULT_LANE_CONFIGS) {
    const laneMap = new Map()

    // 初始化所有已注册 Lane
    for (const laneId of Object.keys(laneConfigs)) {
      laneMap.set(laneId, [])
    }

    if (!events || events.length === 0) {
      return laneMap
    }

    // 构建 domain → laneId 映射
    const domainToLane = {}
    for (const [laneId, config] of Object.entries(laneConfigs)) {
      if (config.domain) {
        domainToLane[config.domain] = laneId
      }
    }

    for (const event of events) {
      // editorialDomain 由 Ingestion 阶段填充
      // 优先使用 metadata.editorialDomain，回退到现有的 category 字段
      const domain = event.editorialDomain
        || event.metadata?.editorialDomain
        || event.category
        || '__fallback__'

      const laneId = domainToLane[domain] || 'fallback'
      laneMap.get(laneId).push(event)
    }

    return laneMap
  }
}
