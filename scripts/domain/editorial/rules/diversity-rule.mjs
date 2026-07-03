/**
 * DiversityRule — Category 覆盖率约束 + 单类别上限控制
 *
 * 规则：
 * - Candidate Pool 必须覆盖 ≥ 5 个 category
 * - 单 category 上限 8 条（BREAKING 不计入上限）
 * - 超出上限的标记为 HOLD（DIVERSITY_CAP）
 * - 覆盖不足时从 review tier（score 55-69）按缺失 category 补入
 *
 * 纯计算，不调 LLM。
 */

import { createFilterSignal } from '../signal.mjs'
import { SCORING } from '../../../config.mjs'

const MIN_CATEGORIES = 5
const MAX_PER_CATEGORY = 8

export class DiversityRule {
  evaluate(events, _context) {
    const signals = []

    const reviewMin = SCORING?.thresholds?.review_min || 55
    const autoMin = SCORING?.thresholds?.auto || 70

    // 获取 BREAKING event IDs（从上下文中传递的已有信号）
    // 注意：DiversityRule 不修改 signal，只做统计
    // breakingEventIds 从 signalLog 中提取（在 CandidateBuilder 中处理）

    // 先按 category 分组
    const byCategory = new Map()
    for (const event of events) {
      const category = event.category || event.metadata?.category || event.curation?.category || 'uncategorized'
      if (!byCategory.has(category)) byCategory.set(category, [])
      byCategory.get(category).push(event)
    }

    // 按 score 降序排列每个 category
    for (const [, list] of byCategory) {
      list.sort((a, b) => {
        const scoreA = a.rank?.totalScore ?? a.rank_total ?? 0
        const scoreB = b.rank?.totalScore ?? b.rank_total ?? 0
        return scoreB - scoreA
      })
    }

    // 若覆盖 < MIN_CATEGORIES，从 review tier 补入
    const coveredCategories = new Set(byCategory.keys())
    if (coveredCategories.size < MIN_CATEGORIES) {
      // 找到所有 review tier 的 event（score 55-69）
      const reviewEvents = events.filter((e) => {
        const score = e.rank?.totalScore ?? e.rank_total ?? 0
        return score >= reviewMin && score < autoMin
      })

      // 按缺失 category 分组
      const missingByCategory = new Map()
      for (const event of reviewEvents) {
        const cat = event.category || event.metadata?.category || event.curation?.category || 'uncategorized'
        if (!coveredCategories.has(cat) && !missingByCategory.has(cat)) {
          missingByCategory.set(cat, [])
        }
        if (!coveredCategories.has(cat)) {
          missingByCategory.get(cat).push(event)
        }
      }

      // 按缺失 category 最高分补入每条
      for (const [, list] of missingByCategory) {
        list.sort((a, b) => {
          const scoreA = a.rank?.totalScore ?? a.rank_total ?? 0
          const scoreB = b.rank?.totalScore ?? b.rank_total ?? 0
          return scoreB - scoreA
        })
      }
    }

    return { signals }
  }

  /**
   * 应用 category 上限（在 CandidateBuilder Filter phase 中调用）
   * @param {Array} candidates — 已构建的 Candidate 列表
   * @param {Set<string>} breakingEventIds — BREAKING 标记的 event ID
   * @returns {Array} signals — DIVERSITY_CAP signals
   */
  applyCap(candidates, breakingEventIds = new Set()) {
    const signals = []

    // 按 category 分组 Candidate
    const byCategory = new Map()
    for (const candidate of candidates) {
      const event = candidate.event
      const category = event.category || event.metadata?.category || event.curation?.category || 'uncategorized'
      if (!byCategory.has(category)) byCategory.set(category, [])
      byCategory.get(category).push(candidate)
    }

    // 单 category 上限
    for (const [, list] of byCategory) {
      if (list.length <= MAX_PER_CATEGORY) continue

      // 按 finalRank 降序排列
      list.sort((a, b) => b.finalRank - a.finalRank)

      // 超出上限的标记 DIVERSITY_CAP（BREAKING 不计入上限）
      let regularCount = 0
      for (const candidate of list) {
        if (breakingEventIds.has(candidate.event.id)) continue
        regularCount++
        if (regularCount > MAX_PER_CATEGORY) {
          signals.push(createFilterSignal(
            'DIVERSITY_CAP', 'DiversityRule',
            `category "${category}" exceeds cap of ${MAX_PER_CATEGORY}`,
            { eventId: candidate.event.id, category }
          ))
        }
      }
    }

    return signals
  }
}
