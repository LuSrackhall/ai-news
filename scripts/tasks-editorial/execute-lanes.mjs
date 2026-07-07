/**
 * ExecuteLanes Task — 各 Lane 独立构建候选池
 *
 * Architecture Editorial Intelligence v2 升级：
 * - 引入 SqliteMemoryStore 替代 JsonEditorialMemoryStore
 * - 引入 JudgmentEngine 在 Lane 构建前运行 Qualification
 * - JudgmentEngine 实例传递给 ctx 供后续 Prioritization 使用
 */

import { ExecutionResult } from '../runtime/result.mjs'
import { BreakingRule } from '../domain/editorial/rules/breaking-rule.mjs'
import { DiversityRule } from '../domain/editorial/rules/diversity-rule.mjs'
import { EditorialMemoryRule } from '../domain/editorial/rules/memory-rule.mjs'
import { ContentRelevanceRule } from '../domain/editorial/rules/content-relevance-rule.mjs'
import { MemoryDedupRule } from '../domain/editorial/rules/dedup-rule.mjs'
import { createRuleContext } from '../domain/editorial/rule-context.mjs'
import { executeLanes } from '../domain/editorial/merge-engine.mjs'
import { SqliteMemoryStore } from '../domain/editorial/memory-store.mjs'
import { JudgmentEngine } from '../domain/editorial/judgment-engine.mjs'
import {
  AuthoritySignal, FreshnessSignal, EntityHeatSignal, SourceDiversitySignal,
} from '../domain/editorial/priority-signals.mjs'

export class ExecuteLanes {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const laneMap = ctx._laneMap
    const laneConfigs = ctx._laneConfigs || {}

    if (!laneMap || laneMap.size === 0) {
      ctx._laneResults = new Map()
      ctx._judgmentEngine = null
      return ExecutionResult.ok({ lanes: 0 })
    }

    const date = ctx.resources?.date || new Date().toISOString().slice(0, 10)

    // 初始化 Memory Store（降级：失败时不影响 pipeline）
    const memoryStore = new SqliteMemoryStore()

    // 初始化 Judgment Engine
    const judgmentEngine = new JudgmentEngine({
      qualificationRules: [
        new ContentRelevanceRule(),
        new BreakingRule(),
        new MemoryDedupRule(),
      ],
      prioritizationSignals: [
        new AuthoritySignal(),
        new FreshnessSignal(),
        new EntityHeatSignal(),
        new SourceDiversitySignal(),
      ],
      memory: memoryStore,
      mode: 'evaluation', // Phase 1 先跑 Evaluation Mode
    })
    ctx._judgmentEngine = judgmentEngine

    // Qualification: 对所有进入 Pipeline 的事件做资格评估
    const allEvents = []
    for (const [, events] of laneMap) {
      allEvents.push(...events)
    }
    const { qualified, rejected } = judgmentEngine.qualify(allEvents, { date, memoryStore })
    ctx._rejectedEvents = rejected

    // 按 Lane 过滤非 Qualified 事件（替换原始 events）
    const qualifiedEventIds = new Set(qualified.map(q => q.event.id))
    const filteredLaneMap = new Map()
    for (const [laneId, events] of laneMap) {
      filteredLaneMap.set(laneId, events.filter(e => qualifiedEventIds.has(e.id)))
    }

    const ruleContext = createRuleContext({ date, memoryStore })

    const rules = [
      new BreakingRule(),
      new DiversityRule(),
      new EditorialMemoryRule(memoryStore),
    ]

    const laneResults = executeLanes(filteredLaneMap, laneConfigs, ruleContext, rules)

    ctx._laneResults = laneResults

    // 统计
    let totalCandidates = 0
    const perLane = {}
    for (const [laneId, result] of laneResults) {
      perLane[laneId] = result.candidates.length
      totalCandidates += result.candidates.length
    }

    return ExecutionResult.ok(
      { lanes: laneResults.size, candidates: totalCandidates, qualified: qualified.length, rejected: rejected.length },
      { per_lane: perLane }
    )
  }
}
