/**
 * MergeCandidates Task — 跨 Lane 合并候选池 + JudgmentEngine Prioritization
 *
 * Architecture Editorial Intelligence v2 升级：
 * - MergeEngine 只做 Lane 合并 + Merge Policy（剥离排序职责）
 * - JudgmentEngine.prioritize() 在合并后运行，负责排序 + Budget 截断
 * - 输出 PrioritizedCandidates 供 CurateEvents 消费
 */

import { ExecutionResult } from '../runtime/result.mjs'
import { MergeEngine } from '../domain/editorial/merge-engine.mjs'
import { DEFAULT_MERGE_CONFIG } from '../domain/editorial/lane-types.mjs'

export class MergeCandidates {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const laneResults = ctx._laneResults
    const judgmentEngine = ctx._judgmentEngine

    if (!laneResults || laneResults.size === 0) {
      ctx._candidates = []
      ctx._buildResult = { candidates: [], stats: { lanes: 0, total: 0 } }
      return ExecutionResult.ok({ candidates: 0 })
    }

    // Phase 1: MergeEngine — 只做合并 + Policy（不排序）
    const engine = new MergeEngine(DEFAULT_MERGE_CONFIG)
    const mergeResult = engine.merge(laneResults)

    // Phase 2: JudgmentEngine Prioritization — 在 budget 内排序
    const budget = DEFAULT_MERGE_CONFIG.maxSize || 40
    let prioritizedCandidates = []

    if (judgmentEngine) {
      // 转换为 QualifiedEvent 格式
      const qualified = mergeResult.candidates.map((c) => ({
        event: c.event || c,
        signals: c.signals || [],
        priorityWeight: c.finalRank || 0,
      }))
      const result = judgmentEngine.prioritize(qualified, budget)
      prioritizedCandidates = result.candidates
    } else {
      // 降级：无 JudgmentEngine 时直接用 MergeEngine 的输出并按 rank 排序
      prioritizedCandidates = [...mergeResult.candidates]
        .sort((a, b) => (b.finalRank || 0) - (a.finalRank || 0))
        .slice(0, budget)
    }

    ctx._candidates = mergeResult.candidates
    ctx._prioritizedCandidates = prioritizedCandidates
    ctx._buildResult = mergeResult

    return ExecutionResult.ok(
      { candidates: prioritizedCandidates.length, merged: mergeResult.candidates.length },
      { stats: mergeResult.stats, prioritized: prioritizedCandidates.length }
    )
  }
}
