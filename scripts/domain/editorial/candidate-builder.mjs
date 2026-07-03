/**
 * CandidateBuilder — 编辑智能层核心引擎
 *
 * Architecture Constitution v1.0 不变量：
 * - 不修改 Event，只产生 Candidate ViewModel
 * - Candidate 不持久化
 * - LLM 不参与 scoring 或 ranking
 *
 * 执行流程：
 *   Events → Collect (Rules) → SignalLog
 *         → Filter (FILTER signals) → Filter View
 *         → Rank (RANK signals, capped +30) → Ranked View
 *         → Annotate (ANNOTATION signals) → Annotated View
 *         → Truncate (top 40) → Candidate[]
 */

import { SignalLog, ResolutionPolicy } from './signal.mjs'

const DEFAULT_MAX_SIZE = 40

/**
 * @typedef {Object} Candidate
 * @property {Object} event — 原始 Event（只读引用）
 * @property {number} finalRank — score + boost
 * @property {string[]} contextHints — ANNOTATION-phase 提示文本
 * @property {Object[]} signals — 该 Candidate 关联的 EditorialSignal[]
 */

/**
 * @typedef {Object} BuildResult
 * @property {Object[]} signalLog — 所有 Rule 产出的 EditorialSignal[]
 * @property {number} filteredIn — Filter phase 后保留数
 * @property {number} filteredOut — 被 HOLD 的事件数
 * @property {Candidate[]} rankedCandidates — Rank 后全量排序（未截断）
 * @property {Candidate[]} finalCandidates — 截断后的最终输出
 */

export class CandidateBuilder {
  /**
   * @param {Array} rules — EditorialRule 实例数组，按此顺序执行
   * @param {Object} [opts]
   * @param {number} [opts.maxSize=40] — 候选池大小上限
   */
  constructor(rules, opts = {}) {
    this._rules = rules
    this._maxSize = opts.maxSize || DEFAULT_MAX_SIZE
  }

  /**
   * @param {Array} events — Event 对象数组
   * @param {Object} context — RuleContext { date, memoryStore }
   * @returns {BuildResult}
   */
  build(events, context = {}) {
    if (!events || events.length === 0) {
      return {
        signalLog: [],
        filteredIn: 0,
        filteredOut: 0,
        rankedCandidates: [],
        finalCandidates: [],
      }
    }

    // Phase 0: Collect — 顺序调用 Rule，收集所有 Signal
    const signalLog = new SignalLog()
    for (const rule of this._rules) {
      try {
        const result = rule.evaluate(events, context)
        if (result?.signals) {
          signalLog.add(result.signals)
        }
      } catch (err) {
        // 单条 Rule 失败不影响其他 Rule
        console.warn(`[CandidateBuilder] Rule "${rule.constructor?.name || 'unknown'}" failed: ${err.message}`)
      }
    }

    // DiversityRule 的 applyCap 需要 candidate 视图
    // 先应用 FILTER phase
    const heldEventIds = ResolutionPolicy.resolveFilter(signalLog, events)

    // 找到 BREAKING event IDs
    const breakingEventIds = new Set()
    for (const sig of signalLog.filterSignals()) {
      if (sig.subtype === 'BREAKING' && sig.metadata?.eventId) {
        breakingEventIds.add(sig.metadata.eventId)
      }
    }

    // Phase 1: Filter — 去除被 HOLD 的 event（BREAKING 除外）
    const filterView = events.filter((e) => {
      if (breakingEventIds.has(e.id)) return true
      return !heldEventIds.has(e.id)
    })
    const filteredOut = events.length - filterView.length

    // Phase 2: Rank — 计算 finalRank
    const boostMap = ResolutionPolicy.resolveRank(signalLog)
    const eventSignalMap = new Map()
    for (const sig of signalLog.all()) {
      if (!sig.metadata?.eventId) continue
      if (!eventSignalMap.has(sig.metadata.eventId)) eventSignalMap.set(sig.metadata.eventId, [])
      eventSignalMap.get(sig.metadata.eventId).push(sig)
    }

    const rankedCandidates = filterView.map((event) => {
      const score = event.rank?.totalScore ?? event.rank_total ?? 0
      const boost = boostMap.get(event.id) || 0
      return {
        event,
        finalRank: score + boost,
        contextHints: [],
        signals: eventSignalMap.get(event.id) || [],
      }
    })

    // 按 finalRank 降序排列
    rankedCandidates.sort((a, b) => b.finalRank - a.finalRank)

    // DiversityRule cap（需要 candidate 视图）
    for (const rule of this._rules) {
      if (typeof rule.applyCap === 'function') {
        const capSignals = rule.applyCap(rankedCandidates, breakingEventIds)
        if (capSignals.length > 0) {
          signalLog.add(capSignals)
          // 重新计算被 cap 影响的 candidate
          const capEventIds = new Set(capSignals.filter((s) => s.subtype === 'DIVERSITY_CAP').map((s) => s.metadata?.eventId).filter(Boolean))
          for (const candidate of rankedCandidates) {
            if (capEventIds.has(candidate.event.id) && !breakingEventIds.has(candidate.event.id)) {
              candidate._held = true
            }
          }
        }
      }
    }

    // Phase 3: Annotate — 生成 contextHints
    const hintMap = ResolutionPolicy.resolveAnnotation(signalLog)
    for (const candidate of rankedCandidates) {
      candidate.contextHints = hintMap.get(candidate.event.id) || []
    }

    // Phase 4: Truncate — 取 top maxSize（不含被 HOLD 的）
    const eligible = rankedCandidates.filter((c) => !c._held)
    const finalCandidates = eligible.slice(0, this._maxSize)

    return {
      signalLog: signalLog.all(),
      filteredIn: filterView.length,
      filteredOut,
      rankedCandidates,
      finalCandidates,
    }
  }
}
