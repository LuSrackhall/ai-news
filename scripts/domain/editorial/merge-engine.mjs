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
    this._protectedIds = new Set()
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

    // breaking_override first: BREAKING candidates get priority sorting
    if (this._policies.breaking_override) {
      pool = this._applyBreakingOverride(pool)
    }

    // minimum_representation after: ensure each non-empty lane has a representative
    // works by marking top-1 from each lane as protected, not by reordering
    if (this._policies.minimum_representation) {
      this._protectedIds.clear()
      pool = this._applyMinRepresentation(pool, laneResults)
    }

    // Phase 3: 全局排序
    // 如果 breaking_override 启用，按 BREAKING + finalRank 排序：BREAKING 在前，其余 normal 在后
    if (this._policies.breaking_override) {
      pool.sort((a, b) => {
        const aBreaking = a._breaking || false
        const bBreaking = b._breaking || false
        if (aBreaking !== bBreaking) return aBreaking ? -1 : 1
        return b.finalRank - a.finalRank
      })
    } else {
      pool.sort((a, b) => b.finalRank - a.finalRank)
    }

    // Phase 4: 截断（保留 protected 项）
    const protectedItems = pool.filter((item) => item._protected)
    const unprotected = pool.filter((item) => !item._protected)

    // 先保留所有 protected，再从未 protected 中按序填充到 maxSize
    const finalPool = [...protectedItems]
    for (const item of unprotected) {
      if (finalPool.length >= this._maxSize) break
      finalPool.push(item)
    }

    return {
      candidates: finalPool.map(({ _laneCandidates, _protected, _breaking, ...rest }) => rest),
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
   * minimum_representation: 非空 Lane 至少保留 1 条 candidate
   * 通过标记 _protected 字段实现，不改变排序
   */
  _applyMinRepresentation(pool, laneResults) {
    const byLane = new Map()
    for (const item of pool) {
      if (!byLane.has(item._laneId)) byLane.set(item._laneId, [])
      byLane.get(item._laneId).push(item)
    }

    for (const [laneId, items] of byLane) {
      const laneResult = laneResults.get(laneId)
      if (!laneResult || !laneResult.candidates || laneResult.candidates.length === 0) continue

      // 标记该 Lane top-1 为 protected
      items.sort((a, b) => b.finalRank - a.finalRank)
      items[0]._protected = true
      this._protectedIds.add(items[0].event?.id || items[0].event?.eventId)
    }

    return pool
  }

  /**
   * breaking_override: 标记 BREAKING Signal 的 Candidate
   * 排序在 Phase 3 中由 breaking_override-aware sort 处理
   */
  _applyBreakingOverride(pool) {
    for (const item of pool) {
      const hasBreaking = item.signals && item.signals.some(
        (s) => s.subtype === 'BREAKING' && s.phase === 'FILTER'
      )
      if (hasBreaking) item._breaking = true
    }
    return pool
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
