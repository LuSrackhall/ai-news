/**
 * MergeEngine — 跨 Lane 合并候选池
 *
 * Architecture Constitution v4.0 约束：
 * - Invariant 5: 确定性执行（纯函数）
 * - Invariant 7: 不包含业务规则
 *
 * 职责：
 * 1. 收集所有 Lane 的 candidates
 * 2. 应用 Merge Policy（minimum_representation / breaking_override）
 * 3. 全局排序（finalRank 降序）
 * 4. 截断到 maxSize（默认 40）
 */

import { CandidateBuilder } from './candidate-builder.mjs'
import { DEFAULT_LANE_CONFIGS, DEFAULT_MERGE_CONFIG } from './lane-types.mjs'

/**
 * 执行所有 Lane 的候选构建（Lane Execution）
 * @param {Map<LaneId, Event[]>} laneMap
 * @param {Object} laneConfigs — LaneId → LaneConfig
 * @param {Object} ruleContext — createRuleContext 的输出
 * @param {Array} rules — CandidateBuilder rules
 * @returns {Map<LaneId, Object>} laneId → { candidates, signalLog, stats }
 */
export function executeLanes(laneMap, laneConfigs = DEFAULT_LANE_CONFIGS, ruleContext = {}, rules = []) {
  const laneResults = new Map()

  for (const [laneId, laneEvents] of laneMap) {
    const config = laneConfigs[laneId]
    if (!config) continue

    // 空 Lane 跳过
    if (!laneEvents || laneEvents.length === 0) {
      laneResults.set(laneId, { candidates: [], signalLog: [], stats: { in: 0, out: 0 } })
      continue
    }

    const builder = new CandidateBuilder(rules, { maxSize: config.maxSize })
    const result = builder.build(laneEvents, ruleContext)

    laneResults.set(laneId, {
      candidates: result.finalCandidates,
      signalLog: result.signalLog,
      stats: { in: result.filteredIn, out: result.filteredOut },
    })
  }

  return laneResults
}

export class MergeEngine {
  /**
   * @param {Object} [mergeConfig] — Merge 配置，默认使用 DEFAULT_MERGE_CONFIG
   */
  constructor(mergeConfig = DEFAULT_MERGE_CONFIG) {
    this._maxSize = mergeConfig.maxSize || 40
    this._policies = mergeConfig.policies || {}
  }

  /**
   * 合并所有 Lane 候选池
   * @param {Map<LaneId, Object>} laneResults — executeLanes 的产出
   * @returns {Object} { candidates, stats }
   */
  merge(laneResults) {
    if (!laneResults || laneResults.size === 0) {
      return { candidates: [], stats: { lanes: 0, total: 0, maxSize: this._maxSize } }
    }

    // Phase 1: Collect — 收集所有 Lane 的 candidates，标记 LaneId
    const allItems = []
    const laneCounts = {}

    for (const [laneId, result] of laneResults) {
      const candidates = result.candidates || []
      laneCounts[laneId] = candidates.length

      for (const c of candidates) {
        allItems.push({
          ...c,
          _laneId: laneId,
          _laneCandidates: candidates,
        })
      }
    }

    if (allItems.length === 0) {
      return { candidates: [], stats: { lanes: laneResults.size, total: 0, maxSize: this._maxSize } }
    }

    // Phase 2: Merge Policy
    let pool = [...allItems]

    if (this._policies.minimum_representation) {
      pool = this._applyMinRepresentation(pool, laneResults)
    }

    if (this._policies.breaking_override) {
      pool = this._applyBreakingOverride(pool)
    }

    // Phase 3: 全局排序
    pool.sort((a, b) => b.finalRank - a.finalRank)

    // Phase 4: 截断
    const finalPool = pool.slice(0, this._maxSize)

    return {
      candidates: finalPool.map(({ _laneId, _laneCandidates, ...rest }) => rest),
      stats: {
        lanes: laneResults.size,
        total: allItems.length,
        maxSize: this._maxSize,
        selected: finalPool.length,
        beforeMerge: laneCounts,
        afterMerge: this._countByLane(finalPool),
      },
    }
  }

  /**
   * minimum_representation: 非空 Lane 至少贡献 1 条
   */
  _applyMinRepresentation(pool, laneResults) {
    const selected = []
    const remaining = []
    const representedLanes = new Set()

    // 按 Lane 分组，取每条 Lane 的 top candidate
    const byLane = new Map()
    for (const item of pool) {
      if (!byLane.has(item._laneId)) byLane.set(item._laneId, [])
      byLane.get(item._laneId).push(item)
    }

    for (const [laneId, items] of byLane) {
      const laneResult = laneResults.get(laneId)
      if (!laneResult || !laneResult.candidates || laneResult.candidates.length === 0) {
        // 空 Lane 不贡献
        for (const item of items) remaining.push(item)
        continue
      }

      // 取该 Lane top 1
      items.sort((a, b) => b.finalRank - a.finalRank)
      selected.push(items[0])
      representedLanes.add(laneId)
      // 其余放入剩余池
      for (let i = 1; i < items.length; i++) remaining.push(items[i])
    }

    return [...selected, ...remaining]
  }

  /**
   * breaking_override: BREAKING Signal 的 Candidate 跨 Lane 优先
   */
  _applyBreakingOverride(pool) {
    const breaking = []
    const normal = []

    for (const item of pool) {
      const hasBreaking = item.signals && item.signals.some(
        (s) => s.subtype === 'BREAKING' && s.phase === 'FILTER'
      )
      if (hasBreaking) breaking.push(item)
      else normal.push(item)
    }

    // BREAKING 在前，其他按 finalRank
    breaking.sort((a, b) => b.finalRank - a.finalRank)
    normal.sort((a, b) => b.finalRank - a.finalRank)

    return [...breaking, ...normal]
  }

  _countByLane(candidates) {
    const counts = {}
    for (const c of candidates) {
      const lid = c._laneId || 'unknown'
      counts[lid] = (counts[lid] || 0) + 1
    }
    return counts
  }
}
