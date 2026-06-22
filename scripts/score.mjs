/**
 * AI 日报 - 评分模块 (Phase 3a)
 * Base Score + Bonus 分层评分，纯代码实现
 *
 * 输入: valid-raw.json 中的条目数组
 * 输出: 每条附带 scores 字段的条目数组
 */

import { SCORING, ENTITY_WEIGHTS, EVENT_TYPE_WEIGHTS, ACADEMIC_SIGNALS } from './config.mjs'

/**
 * 计算权威性分数（Base）
 */
function scoreAuthority(tier) {
  return SCORING.base.authority.tier_scores[tier] || 0
}

/**
 * 计算时效性分数（Base）
 */
function scoreTimeliness(publishedAt) {
  if (!publishedAt) return 2
  const ageHours = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60)
  for (const t of SCORING.base.timeliness.thresholds) {
    if (ageHours <= t.maxHours) return t.score
  }
  return 2
}

/**
 * 计算可验证性分数（Base）
 */
function scoreVerifiability(item, allItems) {
  // 检查是否有其他条目指向同一事件（简化：URL 同域或标题高度相似）
  const sameSourceCount = allItems.filter(
    (other) => other.id !== item.id && other.url && item.url && new URL(other.url).hostname === new URL(item.url).hostname
  ).length

  if (item.tier === 1) return SCORING.base.verifiability.scores.official
  if (sameSourceCount >= 1) return SCORING.base.verifiability.scores.multi_source
  if (item.summary && item.summary.length > 50) return SCORING.base.verifiability.scores.single_with_summary
  return SCORING.base.verifiability.scores.single_no_summary
}

/**
 * 计算内容质量分数（Base）
 */
function scoreContentQuality(item) {
  let score = 0
  const text = `${item.title} ${item.description || ''}`

  // 含具体数字
  if (/\d+/.test(text)) score += SCORING.base.content_quality.has_number

  // 摘要长度 > 100 字
  if (item.summary && item.summary.length > 100) score += SCORING.base.content_quality.summary_long

  // 标题信息密度（含模型名/公司名/动词）
  const titleLower = item.title.toLowerCase()
  const hasModelName = /\b(GPT|Claude|Gemini|Llama|DeepSeek|Mistral|V\d)\b/i.test(item.title)
  const hasCompany = ENTITY_WEIGHTS.top_tier.entities.some((e) => titleLower.includes(e.toLowerCase()))
  const hasActionVerb = /发布|release|launch|announce|融资|acquire|开源/i.test(item.title)
  if (hasModelName || hasCompany || hasActionVerb) score += SCORING.base.content_quality.title_density

  return Math.min(score, SCORING.base.content_quality.max)
}

/**
 * 计算实体权重（Bonus）
 */
function bonusEntityWeight(text) {
  const lower = text.toLowerCase()
  let maxScore = 0
  let matchCount = 0

  for (const tier of Object.values(ENTITY_WEIGHTS)) {
    if (!tier.entities) continue
    for (const entity of tier.entities) {
      if (lower.includes(entity.toLowerCase())) {
        maxScore = Math.max(maxScore, tier.score)
        matchCount++
      }
    }
  }

  if (matchCount >= 2 && maxScore >= 10) {
    maxScore += ENTITY_WEIGHTS.multi_entity_bonus
  }
  return Math.min(maxScore, 12)
}

/**
 * 计算事件类型权重（Bonus）
 */
function bonusEventType(text) {
  const lower = text.toLowerCase()
  let maxScore = EVENT_TYPE_WEIGHTS.general.score

  for (const [_, config] of Object.entries(EVENT_TYPE_WEIGHTS)) {
    if (config.score === 2) continue
    let matched = false
    if (config.keywords) {
      matched = config.keywords.some((kw) => lower.includes(kw.toLowerCase()))
    }
    if (!matched && config.regex) {
      matched = config.regex.test(text)
    }
    if (matched) {
      maxScore = Math.max(maxScore, config.score)
    }
  }
  return Math.min(maxScore, 12)
}

/**
 * 计算量化信号（Bonus）
 */
function bonusQuantitative(text) {
  let score = 0
  if (/\$[\d.]+\s*[bBmM]/.test(text) || /[\d.]+\s*亿/.test(text)) score += 2
  if (/[\d.]+\s*%/.test(text) || /\d+x\s*faster/i.test(text)) score += 1
  if (/\d+\s*(billion|million|百万|千万)/i.test(text)) score += 1
  return Math.min(score, 6)
}

/**
 * 计算学术信号（Bonus）
 */
function bonusAcademic(title) {
  const lower = title.toLowerCase()
  let score = 0
  if (ACADEMIC_SIGNALS.hot_topics.some((kw) => lower.includes(kw.toLowerCase()))) score += ACADEMIC_SIGNALS.hot_topic_score
  if (ACADEMIC_SIGNALS.model_names.some((kw) => lower.includes(kw.toLowerCase()))) score += ACADEMIC_SIGNALS.model_name_score
  if (ACADEMIC_SIGNALS.sota_keywords.some((kw) => lower.includes(kw.toLowerCase()))) score += ACADEMIC_SIGNALS.sota_score
  return Math.min(score, 5)
}

/**
 * 检查跨分类加分（arXiv 论文同时出现在 cs.AI 和 cs.CL）
 */
function crossCategoryBonus(item, allItems) {
  if (item.category !== 'academic') return 0
  // 检查是否有其他源的同 URL 条目
  const hasCrossCategory = allItems.some(
    (other) => other.id !== item.id && other.url === item.url && other.sourceId !== item.sourceId
  )
  return hasCrossCategory ? SCORING.cross_category_bonus : 0
}

/**
 * 对单条新闻计算完整评分
 */
export function scoreItem(item, allItems) {
  const text = `${item.title} ${item.description || ''}`

  const authority = scoreAuthority(item.tier) + crossCategoryBonus(item, allItems)
  const timeliness = scoreTimeliness(item.publishedAt)
  const verifiability = scoreVerifiability(item, allItems)
  const contentQuality = scoreContentQuality(item)

  const baseScore = Math.min(authority, 20) + timeliness + verifiability + contentQuality

  const entityWeight = bonusEntityWeight(text)
  const eventType = bonusEventType(text)
  const quantSignal = bonusQuantitative(text)
  const academicSignal = bonusAcademic(item.title)

  const bonusScore = entityWeight + eventType + quantSignal + academicSignal
  const totalScore = Math.min(baseScore + bonusScore, 100)

  // 确定 tier_label
  let tierLabel = 'skip'
  if (totalScore >= SCORING.thresholds.auto) tierLabel = 'auto'
  else if (totalScore >= SCORING.thresholds.review_min) tierLabel = 'review'

  return {
    ...item,
    scores: {
      base: {
        authority: Math.min(authority, 20),
        timeliness,
        verifiability,
        content_quality: contentQuality,
        subtotal: baseScore,
      },
      bonus: {
        entity_weight: entityWeight,
        event_type: eventType,
        quant_signal: quantSignal,
        academic_signal: academicSignal,
        subtotal: bonusScore,
      },
      total: totalScore,
    },
    tier_label: tierLabel,
  }
}

/**
 * 对所有条目评分，并应用同源上限
 */
export function scoreAll(items) {
  // 先评分
  const scored = items.map((item) => scoreItem(item, items))

  // 按总分降序排序
  scored.sort((a, b) => b.scores.total - a.scores.total)

  // 应用同源上限
  const sourceCounts = {}
  const result = []

  for (const item of scored) {
    const sourceId = item.sourceId
    const cap = SCORING.source_caps[sourceId] || SCORING.source_caps._default

    if (!sourceCounts[sourceId]) sourceCounts[sourceId] = 0

    if (item.tier_label === 'auto' || item.tier_label === 'review') {
      sourceCounts[sourceId]++
      if (sourceCounts[sourceId] > cap) {
        // 超出同源上限，降级为 skip
        item.tier_label = 'skip'
        item.scores._capped = true
        item.scores._cap_reason = `同源上限 ${cap} 条（${sourceId}）`
      }
    }

    result.push(item)
  }

  return result
}
