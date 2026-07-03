/**
 * BuildCandidates Task — 构建候选池
 *
 * 在 SelectEditorialWindow 之后、CurateEvents 之前执行。
 * 调用 CandidateBuilder，产出 ctx._candidates + ctx._buildResult。
 */

import { ExecutionResult } from '../runtime/result.mjs'
import { CandidateBuilder } from '../domain/editorial/candidate-builder.mjs'
import { BreakingRule } from '../domain/editorial/rules/breaking-rule.mjs'
import { DiversityRule } from '../domain/editorial/rules/diversity-rule.mjs'
import { EditorialMemoryRule } from '../domain/editorial/rules/memory-rule.mjs'
import { createRuleContext } from '../domain/editorial/rule-context.mjs'
import { JsonEditorialMemoryStore } from '../services/editorial-memory-store.mjs'

export class BuildCandidates {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const events = ctx._events || []
    if (events.length === 0) {
      ctx._candidates = []
      ctx._buildResult = { signalLog: [], filteredIn: 0, filteredOut: 0, rankedCandidates: [], finalCandidates: [] }
      return ExecutionResult.ok({ candidates: 0 }, { input: 0 })
    }

    const date = ctx.resources?.date || new Date().toISOString().slice(0, 10)
    const memoryStore = new JsonEditorialMemoryStore()
    const ruleContext = createRuleContext({ date, memoryStore })

    const builder = new CandidateBuilder([
      new BreakingRule(),
      new DiversityRule(),
      new EditorialMemoryRule(memoryStore),
    ])

    const buildResult = builder.build(events, ruleContext)

    ctx._candidates = buildResult.finalCandidates
    ctx._buildResult = buildResult

    return ExecutionResult.ok(
      { candidates: buildResult.finalCandidates.length },
      {
        input: events.length,
        candidates: buildResult.finalCandidates.length,
        filtered_in: buildResult.filteredIn,
        filtered_out: buildResult.filteredOut,
      }
    )
  }
}
