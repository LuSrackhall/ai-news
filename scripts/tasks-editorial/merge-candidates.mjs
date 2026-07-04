/**
 * MergeCandidates Task — 跨 Lane 合并候选池
 *
 * 读取 ctx._laneResults，调用 MergeEngine，产出 ctx._candidates + ctx._buildResult。
 */

import { ExecutionResult } from '../runtime/result.mjs'
import { MergeEngine } from '../domain/editorial/merge-engine.mjs'
import { DEFAULT_MERGE_CONFIG } from '../domain/editorial/lane-types.mjs'

export class MergeCandidates {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const laneResults = ctx._laneResults

    if (!laneResults || laneResults.size === 0) {
      ctx._candidates = []
      ctx._buildResult = { candidates: [], stats: { lanes: 0, total: 0 } }
      return ExecutionResult.ok({ candidates: 0 })
    }

    const engine = new MergeEngine(DEFAULT_MERGE_CONFIG)
    const result = engine.merge(laneResults)

    ctx._candidates = result.candidates
    ctx._buildResult = result

    return ExecutionResult.ok(
      { candidates: result.candidates.length },
      { stats: result.stats }
    )
  }
}
