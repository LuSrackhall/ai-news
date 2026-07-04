/**
 * Lane Types — Lane 系统类型定义与默认配置
 *
 * Architecture Constitution v4.0 约束：
 * - Invariant 6: Lane 集合通过配置定义，不硬编码
 * - Invariant 7: Runtime 只编排，业务规则在 Domain
 */

/**
 * @typedef {string} LaneId — 稳定字符串，由 Publication 配置声明
 */

/**
 * @typedef {Object} LaneConfig
 * @property {string} domain — 对应的 editorialDomain 值
 * @property {number} maxSize — 该 Lane 候选池大小上限
 */

/**
 * @typedef {Object} LaneResult
 * @property {Array} candidates — 该 Lane 的最终候选池
 * @property {Array} signalLog — 该 Lane 的 Signal 日志
 * @property {Object} stats — 统计信息 { in, out }
 */

/**
 * @typedef {Map<LaneId, LaneConfig>} LaneConfigMap
 * @typedef {Map<LaneId, Object[]>} LaneMap  — LaneId → Event[]
 * @typedef {Map<LaneId, LaneResult>} LaneResultsMap — LaneId → LaneResult
 */

/**
 * Phase 2 默认 Lane 配置
 * LaneId 与 editorialDomain 一一映射
 */
export const DEFAULT_LANE_CONFIGS = {
  research:   { domain: 'research',   maxSize: 20 },
  industry:   { domain: 'industry',   maxSize: 20 },
  policy:     { domain: 'policy',     maxSize: 10 },
  opensource: { domain: 'opensource', maxSize: 10 },
  fallback:   { domain: '__fallback__', maxSize: 5 },
}

/**
 * 默认 Merge Policy 配置
 */
export const DEFAULT_MERGE_CONFIG = {
  maxSize: 40,
  policies: {
    minimum_representation: true,
    breaking_override: true,
    global_diversity: true,
  },
}
