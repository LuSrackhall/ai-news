/**
 * Ranking Domain — 评分与分级
 * 合并 score.mjs + collect-rss.mjs 的 computeImpactScore
 * 评分逻辑只有一个权威来源
 */

import { SCORING, ENTITY_WEIGHTS, EVENT_TYPE_WEIGHTS, ACADEMIC_SIGNALS } from '../config.mjs'
import { computeAssetHash } from '../engine/schemas.mjs'

export function createRankingDomain(ctx) {
  // ── Base Score 计算函数（从 score.mjs 迁移）──

  function scoreAuthority(tier) {
    return SCORING.base.authority.tier_scores[tier] || 0
  }

  function scoreTimeliness(publishedAt, sourceConfig) {
    if (!publishedAt) return 2
    const ageHours = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60)
    let score = 2
    for (const t of SCORING.base.timeliness.thresholds) {
      if (ageHours <= t.maxHours) { score = t.score; break }
    }
    if (sourceConfig?.dateReliability === 'low') score = Math.floor(score / 2)
    return score
  }

  function scoreVerifiability(item, allItems) {
    const sameSourceCount = allItems.filter(
      (other) => other.id !== item.id && other.url && item.url && new URL(other.url).hostname === new URL(item.url).hostname
    ).length
    if (item.tier === 1) return SCORING.base.verifiability.scores.official
    if (sameSourceCount >= 1) return SCORING.base.verifiability.scores.multi_source
    if (item.summary && item.summary.length > 50) return SCORING.base.verifiability.scores.single_with_summary
    return SCORING.base.verifiability.scores.single_no_summary
  }

  function scoreContentQuality(item) {
    let score = 0
    const text = `${item.title} ${item.description || ''}`
    if (/\d+/.test(text)) score += SCORING.base.content_quality.has_number
    if (item.summary && item.summary.length > 100) score += SCORING.base.content_quality.summary_long
    const titleLower = item.title.toLowerCase()
    const hasModelName = /\b(GPT|Claude|Gemini|Llama|DeepSeek|Mistral|V\d)\b/i.test(item.title)
    const hasCompany = ENTITY_WEIGHTS.top_tier.entities.some((e) => titleLower.includes(e.toLowerCase()))
    const hasActionVerb = /发布|release|launch|announce|融资|acquire|开源/i.test(item.title)
    if (hasModelName || hasCompany || hasActionVerb) score += SCORING.base.content_quality.title_density
    return Math.min(score, SCORING.base.content_quality.max)
  }

  // ── Bonus Score 计算函数（从 score.mjs 迁移）──

  function bonusEntityWeight(text) {
    const lower = text.toLowerCase()
    let maxScore = 0, matchCount = 0
    for (const tier of Object.values(ENTITY_WEIGHTS)) {
      if (!tier.entities) continue
      for (const entity of tier.entities) {
        if (lower.includes(entity.toLowerCase())) {
          maxScore = Math.max(maxScore, tier.score)
          matchCount++
        }
      }
    }
    if (matchCount >= 2 && maxScore >= 10) maxScore += ENTITY_WEIGHTS.multi_entity_bonus
    return Math.min(maxScore, 12)
  }

  function bonusEventType(text) {
    const lower = text.toLowerCase()
    let maxScore = EVENT_TYPE_WEIGHTS.general.score
    for (const [_, config] of Object.entries(EVENT_TYPE_WEIGHTS)) {
      if (config.score === 2) continue
      let matched = false
      if (config.keywords) matched = config.keywords.some((kw) => lower.includes(kw.toLowerCase()))
      if (!matched && config.regex) matched = config.regex.test(text)
      if (matched) maxScore = Math.max(maxScore, config.score)
    }
    return Math.min(maxScore, 12)
  }

  function bonusQuantitative(text) {
    let score = 0
    if (/\$[\d.]+\s*[bBmM]/.test(text) || /[\d.]+\s*亿/.test(text)) score += 2
    if (/[\d.]+\s*%/.test(text) || /\d+x\s*faster/i.test(text)) score += 1
    if (/\d+\s*(billion|million|百万|千万)/i.test(text)) score += 1
    return Math.min(score, 6)
  }

  function bonusAcademic(title) {
    const lower = title.toLowerCase()
    let score = 0
    if (ACADEMIC_SIGNALS.hot_topics.some((kw) => lower.includes(kw.toLowerCase()))) score += ACADEMIC_SIGNALS.hot_topic_score
    if (ACADEMIC_SIGNALS.model_names.some((kw) => lower.includes(kw.toLowerCase()))) score += ACADEMIC_SIGNALS.model_name_score
    if (ACADEMIC_SIGNALS.sota_keywords.some((kw) => lower.includes(kw.toLowerCase()))) score += ACADEMIC_SIGNALS.sota_score
    return Math.min(score, 5)
  }

  function crossCategoryBonus(item, allItems) {
    if (item.category !== 'academic') return 0
    const hasCrossCategory = allItems.some(
      (other) => other.id !== item.id && other.url === item.url && other.sourceId !== item.sourceId
    )
    return hasCrossCategory ? SCORING.cross_category_bonus : 0
  }

  // ── 核心接口 ──

  function scoreItem(item, allItems) {
    const text = `${item.title} ${item.description || ''}`
    const authority = scoreAuthority(item.tier || item.source?.tier) + crossCategoryBonus(item, allItems)
    const timeliness = scoreTimeliness(item.publishedAt, { dateReliability: item.dateReliability })
    const verifiability = scoreVerifiability(item, allItems)
    const contentQuality = scoreContentQuality(item)
    const baseScore = Math.min(authority, 20) + timeliness + verifiability + contentQuality

    const entityWeight = bonusEntityWeight(text)
    const eventType = bonusEventType(text)
    const quantSignal = bonusQuantitative(text)
    const academicSignal = bonusAcademic(item.title)
    const bonusScore = entityWeight + eventType + quantSignal + academicSignal
    const totalScore = Math.min(baseScore + bonusScore, 100)

    let tierLabel = 'skip'
    if (totalScore >= SCORING.thresholds.auto) tierLabel = 'auto'
    else if (totalScore >= SCORING.thresholds.review_min) tierLabel = 'review'

    return {
      ...item,
      rank: {
        baseScore,
        bonusScore,
        totalScore,
        tierLabel,
        factors: {
          authority: Math.min(authority, 20),
          timeliness,
          verifiability,
          contentQuality,
          entityWeight,
          eventType,
          quantSignal,
          academicSignal,
        },
      },
    }
  }

  return {
    scoreAll(assets) {
      const scored = assets.map((item) => scoreItem(item, assets))
      scored.sort((a, b) => b.rank.totalScore - a.rank.totalScore)

      // 48 小时年龄门禁
      for (const item of scored) {
        if (item.publishedAt) {
          const ageHours = (Date.now() - new Date(item.publishedAt).getTime()) / (1000 * 60 * 60)
          if (ageHours > 48) {
            item.rank.tierLabel = 'skip'
            item.rank._ageFiltered = true
          }
        }
      }

      // 同源上限
      const sourceCounts = {}
      for (const item of scored) {
        const sourceId = item.sourceId || item.source?.name || 'unknown'
        const cap = SCORING.source_caps[sourceId] || SCORING.source_caps._default
        if (!sourceCounts[sourceId]) sourceCounts[sourceId] = 0
        if (item.rank.tierLabel === 'auto' || item.rank.tierLabel === 'review') {
          sourceCounts[sourceId]++
          if (sourceCounts[sourceId] > cap) {
            item.rank.tierLabel = 'skip'
            item.rank._capped = true
          }
        }
      }

      return scored
    },

    classify(scoredAssets) {
      return {
        auto: scoredAssets.filter((i) => i.rank.tierLabel === 'auto'),
        review: scoredAssets.filter((i) => i.rank.tierLabel === 'review'),
        skip: scoredAssets.filter((i) => i.rank.tierLabel === 'skip'),
      }
    },

    buildEvents(scoredAssets) {
      return scoredAssets.map((asset) => ({
        id: asset.id,
        type: 'news',
        title: asset.title,
        summary: asset.summary || asset.summary_zh || '',
        url: asset.url,
        sources: [{
          name: asset.source?.name || asset.source_name || 'unknown',
          tier: asset.source?.tier || asset.tier || 3,
          url: asset.url,
          publishedAt: asset.publishedAt || asset.published_at,
        }],
        assetIds: [asset.id],
        clusterId: null,
        contentHash: asset.contentHash || computeAssetHash(asset),
        rank: asset.rank,
        curation: null,
        entities: [],
        topics: [],
        relatedEventIds: [],
        timeline: {
          collected: asset.fetchedAt || new Date().toISOString(),
          verified: asset.verifiedAt || null,
          curated: null,
          generated: null,
        },
        metadata: {
          category: asset.category || null,
          impactScore: asset.metadata?.impactScore || asset.impactScore || null,
          sourceId: asset.sourceId || null,
        },
      }))
    },
  }
}
