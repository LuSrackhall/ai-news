/**
 * ExecuteLanes Task — 各 Lane 独立构建候选池
 *
 * 读取 ctx._laneMap，对每个 Lane 执行 CandidateBuilder，产出 ctx._laneResults。
 */

import { ExecutionResult } from '../runtime/result.mjs'
import { BreakingRule } from '../domain/editorial/rules/breaking-rule.mjs'
import { DiversityRule } from '../domain/editorial/rules/diversity-rule.mjs'
import { EditorialMemoryRule } from '../domain/editorial/rules/memory-rule.mjs'
import { createRuleContext } from '../domain/editorial/rule-context.mjs'
import { JsonEditorialMemoryStore } from '../services/editorial-memory-store.mjs'
import { executeLanes } from '../domain/editorial/merge-engine.mjs'

export class ExecuteLanes {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const laneMap = ctx._laneMap
    const laneConfigs = ctx._laneConfigs || {}

    if (!laneMap || laneMap.size === 0) {
      ctx._laneResults = new Map()
      return ExecutionResult.ok({ lanes: 0 })
    }

    const date = ctx.resources?.date || new Date().toISOString().slice(0, 10)
    const memoryStore = new JsonEditorialMemoryStore()
    const ruleContext = createRuleContext({ date, memoryStore })

    const rules = [
      new BreakingRule(),
      new DiversityRule(),
      new EditorialMemoryRule(memoryStore),
    ]

    const laneResults = executeLanes(laneMap, laneConfigs, ruleContext, rules)

    ctx._laneResults = laneResults

    // 统计
    let totalCandidates = 0
    const perLane = {}
    for (const [laneId, result] of laneResults) {
      perLane[laneId] = result.candidates.length
      totalCandidates += result.candidates.length
    }

    return ExecutionResult.ok(
      { lanes: laneResults.size, candidates: totalCandidates },
      { per_lane: perLane }
    )
  }
}
