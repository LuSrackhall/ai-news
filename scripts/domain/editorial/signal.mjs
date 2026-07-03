/**
 * EditorialSignal — Rule 输出的统一信号模型
 *
 * Architecture Constitution v1.0 不变量：
 * - Signal 是 Rule 的不可变输出，不修改 Event
 * - phase 决定消费阶段，subtype 是业务语义
 */

/**
 * @typedef {Object} EditorialSignal
 * @property {"FILTER"|"RANK"|"ANNOTATION"} phase — 信号消费阶段
 * @property {string} subtype — 业务语义（BREAKING, DIVERSITY_CAP, MEMORY, ENTITY_PRIORITY, ...）
 * @property {number} weight — RANK: ±30, FILTER/ANNOTATION: 0
 * @property {string} source — Rule 名称，可追溯
 * @property {string} reason — 人类可读触发原因
 * @property {Object} [metadata] — 类型相关附加上下文
 */

/**
 * Factory: 创建一条 EditorialSignal
 */
export function createSignal(phase, subtype, source, reason, metadata = {}) {
  return {
    phase,
    subtype,
    weight: 0,
    source,
    reason,
    metadata,
  }
}

/**
 * Factory: 创建一条 RANK-phase Signal（带 weight）
 */
export function createRankSignal(subtype, weight, source, reason, metadata = {}) {
  return { phase: 'RANK', subtype, weight, source, reason, metadata }
}

/**
 * Factory: 创建一条 FILTER-phase Signal
 */
export function createFilterSignal(subtype, source, reason, metadata = {}) {
  return { phase: 'FILTER', subtype, weight: 0, source, reason, metadata }
}

/**
 * Factory: 创建一条 ANNOTATION-phase Signal
 */
export function createAnnotationSignal(subtype, source, reason, metadata = {}) {
  return { phase: 'ANNOTATION', subtype, weight: 0, source, reason, metadata }
}

/**
 * SignalLog — 所有 Rule 产出的 Signal 集合
 * 追加式合并：后执行的 Rule 不覆盖已有 Signal
 */
export class SignalLog {
  constructor() { this._signals = [] }

  add(signals) {
    if (Array.isArray(signals)) this._signals.push(...signals)
  }

  all() { return this._signals }

  byEvent(eventId) {
    return this._signals.filter((s) => s.metadata?.eventId === eventId)
  }

  /** FILTER-phase signals, grouped by eventId */
  filterSignals() {
    return this._signals.filter((s) => s.phase === 'FILTER')
  }

  /** RANK-phase signals, grouped by eventId */
  rankSignals() {
    return this._signals.filter((s) => s.phase === 'RANK')
  }

  /** ANNOTATION-phase signals */
  annotationSignals() {
    return this._signals.filter((s) => s.phase === 'ANNOTATION')
  }

  get length() { return this._signals.length }
}

/**
 * ResolutionPolicy — 三阶段 Signal 解析
 */
export const ResolutionPolicy = {
  /**
   * Phase FILTER: 决定哪些 event 被 HOLD（不可入选）
   * @returns {Set<string>} heldEventIds — 被 HOLD 的 event ID 集合
   */
  resolveFilter(signalLog, events) {
    const heldEventIds = new Set()
    const breakingEventIds = new Set()

    // 第一遍：找到所有 BREAKING event
    for (const sig of signalLog.filterSignals()) {
      if (sig.subtype === 'BREAKING' && sig.metadata?.eventId) {
        breakingEventIds.add(sig.metadata.eventId)
      }
    }

    // 第二遍：应用 HOLD，BREAKING 覆盖
    for (const sig of signalLog.filterSignals()) {
      if (sig.subtype === 'DIVERSITY_CAP' && sig.metadata?.eventId) {
        if (!breakingEventIds.has(sig.metadata.eventId)) {
          heldEventIds.add(sig.metadata.eventId)
        }
      }
    }

    return heldEventIds
  },

  /**
   * Phase RANK: 计算每条 event 的 boost
   * @returns {Map<string, number>} eventId → total boost (capped +30)
   */
  resolveRank(signalLog) {
    const boosts = new Map()

    for (const sig of signalLog.rankSignals()) {
      if (!sig.metadata?.eventId) continue
      const current = boosts.get(sig.metadata.eventId) || 0
      boosts.set(sig.metadata.eventId, current + (sig.weight || 0))
    }

    // Cap at +30
    for (const [eventId, boost] of boosts) {
      if (boost > 30) boosts.set(eventId, 30)
    }

    return boosts
  },

  /**
   * Phase ANNOTATION: 生成 contextHints
   * @returns {Map<string, string[]>} eventId → contextHints[]
   */
  resolveAnnotation(signalLog) {
    const hints = new Map()

    for (const sig of signalLog.annotationSignals()) {
      if (!sig.metadata?.eventId) continue
      const list = hints.get(sig.metadata.eventId) || []
      list.push(sig.reason)
      if (sig.subtype === 'MEMORY' && sig.metadata?.recentDays >= 2) {
        list.push(
          `此事件（entity: ${sig.metadata.entity || 'unknown'}）已在最近 ${sig.metadata.recentDays} 天持续报道，可考虑作为一句话更新而非重复深度分析`
        )
      }
      hints.set(sig.metadata.eventId, list)
    }

    return hints
  },
}
