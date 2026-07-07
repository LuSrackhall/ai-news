/**
 * JudgmentEngine — 编辑决策引擎核心
 *
 * Architecture Editorial Intelligence v2 不变量：
 * - Qualification 不排序，只回答"值不值得"
 * - Prioritization 不淘汰，只回答"今天排第几"
 * - Signal-based decision，不依赖单一评分公式
 * - Memory is advisory（冷启动不依赖）
 *
 * 执行流程：
 *   Events → Qualification → QualifiedEvents / RejectedEvents
 *       → Prioritization (budget-aware) → PrioritizedCandidates
 */

import { createFilterSignal } from './signal.mjs'

// ───────── 错误码 ─────────

export const ERROR_CODES = {
  INVALID_BUDGET: 'INVALID_BUDGET',
  MEMORY_FAILURE: 'MEMORY_FAILURE',
}

// ───────── 拒绝类型 ─────────

export const REJECTION_TYPE = {
  HARD: 'hard',
  CONTEXTUAL: 'contextual',
}

// ───────── 指标键 ─────────

const METRIC_KEYS = {
  TOTAL_INPUT: 'total_input',
  QUALIFIED: 'qualified',
  HARD_REJECTED: 'hard_rejected',
  CONTEXTUAL_REJECTED: 'contextual_rejected',
  PRIORITIZED: 'prioritized',
  SOURCE_DISTRIBUTION: 'source_distribution',
}

/**
 * @typedef {Object} QualifiedEvent
 * @property {Object} event — 原始事件（只读引用）
 * @property {string[]} signals — 关联的信号描述
 * @property {number} priorityWeight — Qualification 阶段评估的权重（用于 Prioritization）
 */

/**
 * @typedef {Object} RejectedEvent
 * @property {Object} event
 * @property {'hard'|'contextual'} type
 * @property {string} reason
 * @property {string[]} signals
 */

/**
 * @typedef {Object} PrioritizedCandidate
 * @property {Object} event
 * @property {number} priorityWeight
 * @property {number} finalRank — 最终排序值
 * @property {string[]} signals
 */

/**
 * @typedef {Object} QualificationResult
 * @property {QualifiedEvent[]} qualified
 * @property {RejectedEvent[]} rejected
 * @property {Object} metrics — Evaluation mode 指标
 */

/**
 * @typedef {Object} PrioritizationResult
 * @property {PrioritizedCandidate[]} candidates
 * @property {Object} metrics — Evaluation mode 指标
 */

export class JudgmentEngine {
  /**
   * @param {Object} opts
   * @param {Array} [opts.qualificationRules] — Qualification 阶段的规则数组
   * @param {Array} [opts.prioritizationSignals] — Prioritization 阶段的信号数组
   * @param {Object} [opts.memory] — Memory Store 实例（可选）
   * @param {string} [opts.mode='production'] — 'evaluation' | 'production'
   */
  constructor(opts = {}) {
    this._qualificationRules = opts.qualificationRules || []
    this._prioritizationSignals = opts.prioritizationSignals || []
    this._memory = opts.memory || null
    this._mode = opts.mode || 'production'

    // Evaluation mode 指标
    this._metrics = {
      totalInput: 0,
      qualifiedCount: 0,
      hardRejected: 0,
      contextualRejected: 0,
      prioritizedCount: 0,
      sourceDistribution: {},
    }
  }

  get mode() { return this._mode }
  get metrics() { return { ...this._metrics } }

  // ───────── Qualification ─────────

  /**
   * Qualification 阶段：判断事件是否值得报道
   *
   * @param {Object[]} events — Event 对象数组
   * @param {Object} [context] — 上下文 { date, memory }
   * @returns {QualificationResult}
   */
  qualify(events, context = {}) {
    if (!events || events.length === 0) {
      return { qualified: [], rejected: [], metrics: this._collectMetrics() }
    }

    const qualified = []
    const rejected = []

    for (const event of events) {
      const signals = this._evaluateQualificationSignals(event, context)
      const { isRejected, rejectType, rejectReason } = this._decideQualification(event, signals)

      if (isRejected) {
        rejected.push({
          event,
          type: rejectType,
          reason: rejectReason,
          signals,
        })

        // 记录到 Memory
        if (this._memory) {
          this._memory.logRejectedEvent({
            eventId: event.id,
            eventTitle: event.title,
            reason: rejectReason,
            rejectType,
            sourceName: event.source?.name || event.source_name,
          })
        }
      } else {
        qualified.push({
          event,
          signals,
          priorityWeight: this._computePriorityWeight(event, signals),
        })
      }
    }

    this._collectMetrics(events.length, qualified.length, rejected)
    return { qualified, rejected, metrics: this._collectMetrics() }
  }

  /**
   * 运行所有 Qualification 规则，收集信号
   * @private
   */
  _evaluateQualificationSignals(event, context) {
    const signals = []
    for (const rule of this._qualificationRules) {
      try {
        const result = rule.evaluate([event], context)
        if (result?.signals) {
          signals.push(...result.signals)
        }
      } catch {
        // 单条 Rule 失败不影响其他 Rule
      }
    }
    return signals
  }

  /**
   * 根据信号做 Qualification 决策
   * @private
   */
  _decideQualification(event, signals) {
    // Hard Rejection: 非 AI 相关内容
    for (const sig of signals) {
      if (sig.subtype === 'CONTENT_REJECTION') {
        return { isRejected: true, rejectType: REJECTION_TYPE.HARD, rejectReason: sig.reason }
      }
    }

    // 查询 Memory 中的 Contextual Rejection 历史
    if (this._memory) {
      const rejectionHistory = this._memory.getRejectionHistory(event.id)
      // 如果之前被 hard rejected 过，继续拒绝
      const hardRejections = rejectionHistory.filter(r => r.reject_type === 'hard')
      if (hardRejections.length > 0) {
        return { isRejected: true, rejectType: REJECTION_TYPE.HARD, rejectReason: `previously rejected: ${hardRejections[0].reason}` }
      }
    }

    // BREAKING signal → 无条件通过 Qualification（覆盖 STALE）
    for (const sig of signals) {
      if (sig.subtype === 'BREAKING') {
        return { isRejected: false }
      }
    }

    // STALE signal → contextual rejection（可被 BREAKING 覆盖）
    for (const sig of signals) {
      if (sig.subtype === 'STALE') {
        return { isRejected: true, rejectType: REJECTION_TYPE.CONTEXTUAL, rejectReason: sig.reason }
      }
    }

    // 默认通过（后续由 Prioritization 根据信号排序）
    return { isRejected: false }
  }

  /**
   * 计算 Qualification 阶段的优先级权重
   * 供 Prioritization 使用，但 Qualification 不排序
   * @private
   */
  _computePriorityWeight(event, signals) {
    let weight = 0
    for (const sig of signals) {
      if (sig.phase === 'RANK' && sig.weight) {
        weight += sig.weight
      }
    }
    return weight
  }

  /**
   * 收集 Qualification 指标
   * @private
   */
  _collectMetrics(totalInput = null, qualifiedCount = null, rejected = null) {
    if (totalInput !== null) {
      this._metrics.totalInput += totalInput
      this._metrics.qualifiedCount += qualifiedCount
      for (const r of rejected) {
        if (r.type === 'hard') this._metrics.hardRejected++
        else this._metrics.contextualRejected++
      }

      // 来源分布
      for (const r of rejected) {
        const source = r.event.source?.name || r.event.source_name || 'unknown'
        this._metrics.sourceDistribution[source] = (this._metrics.sourceDistribution[source] || 0) + 1
      }
      for (const q of [rejected]) {
        if (!q) continue
        for (const item of rejected) {
          const e = item.event
          const src = e.source?.name || e.source_name || 'unknown'
          this._metrics.sourceDistribution[src] = (this._metrics.sourceDistribution[src] || 0) + 1
        }
      }
    }

    return { ...this._metrics }
  }

  // ───────── Prioritization ─────────

  /**
   * Prioritization 阶段：在预算约束下排序
   *
   * @param {QualifiedEvent[]} qualifiedEvents
   * @param {number} budget — 最大输出数
   * @param {Object} [context] — 上下文 { memory, date }
   * @returns {PrioritizationResult}
   */
  prioritize(qualifiedEvents, budget = 40, context = {}) {
    if (!qualifiedEvents || qualifiedEvents.length === 0) {
      return { candidates: [], metrics: this._metrics }
    }

    if (budget <= 0) {
      const err = new Error('Budget must be > 0')
      err.code = ERROR_CODES.INVALID_BUDGET
      throw err
    }

    // 应用 Prioritization 信号，计算 finalRank
    const candidates = qualifiedEvents.map((qe) => {
      const signals = this._evaluatePrioritizationSignals(qe.event, context)
      const finalRank = this._computeFinalRank(qe, signals)
      return {
        event: qe.event,
        priorityWeight: qe.priorityWeight,
        finalRank,
        signals: [...qe.signals, ...signals],
      }
    })

    // 按 finalRank 降序排列
    candidates.sort((a, b) => b.finalRank - a.finalRank)

    // Budget 约束
    const prioritized = candidates.slice(0, budget)
    this._metrics.prioritizedCount = prioritized.length

    return { candidates: prioritized, metrics: this._collectMetrics() }
  }

  /**
   * 运行 Prioritization 信号
   * @private
   */
  _evaluatePrioritizationSignals(event, context) {
    const signals = []
    for (const signal of this._prioritizationSignals) {
      try {
        const result = signal.evaluate([event], context)
        if (result?.signals) {
          signals.push(...result.signals)
        }
      } catch {
        // 单条 Signal 失败不影响
      }
    }
    return signals
  }

  /**
   * 计算最终排序值
   * @private
   */
  _computeFinalRank(qualifiedEvent, signals) {
    let rank = qualifiedEvent.priorityWeight || 0

    // 基础分数
    const score = qualifiedEvent.event.rank?.totalScore ?? qualifiedEvent.event.rank_total ?? 0
    rank += score

    // BREAKING 加成
    for (const sig of signals) {
      if (sig.subtype === 'BREAKING') rank += 50
    }

    return rank
  }

  // ───────── Evaluation / Production Mode ─────────

  /**
   * 设置运行模式
   * @param {'evaluation'|'production'} mode
   */
  setMode(mode) {
    this._mode = mode
  }

  /**
   * 检查是否通过 Production Mode 约束
   * @param {Object} constraints — { maxNonAiRatio, maxSingleSourceRatio }
   * @returns {Object} { passed, violations }
   */
  checkProductionConstraints(constraints = {}) {
    const violations = []
    const m = this._metrics
    const total = m.totalInput || 1

    // 非 AI 内容占比
    const maxNonAiRatio = constraints.maxNonAiRatio || 0.05
    const nonAiRatio = m.hardRejected / (m.hardRejected + m.qualifiedCount || 1)
    if (nonAiRatio > maxNonAiRatio) {
      violations.push(`non_ai_ratio: ${(nonAiRatio * 100).toFixed(1)}% > ${(maxNonAiRatio * 100).toFixed(1)}%`)
    }

    // 单源占比
    const maxSingleSrc = constraints.maxSingleSourceRatio || 0.35
    const srcEntries = Object.entries(m.sourceDistribution)
    for (const [src, count] of srcEntries) {
      const ratio = count / total
      if (ratio > maxSingleSrc) {
        violations.push(`single_source_${src}: ${(ratio * 100).toFixed(1)}% > ${(maxSingleSrc * 100).toFixed(1)}%`)
      }
    }

    return { passed: violations.length === 0, violations }
  }

  /**
   * 重置指标
   */
  resetMetrics() {
    this._metrics = {
      totalInput: 0,
      qualifiedCount: 0,
      hardRejected: 0,
      contextualRejected: 0,
      prioritizedCount: 0,
      sourceDistribution: {},
    }
  }
}
