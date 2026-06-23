/**
 * Dedup Domain — 跨日去重
 * 三级去重：URL 精确 → 事件指纹 → 标题 bigram 相似度
 * 从 dedup.mjs 迁移，去掉 outputDir 参数，改用 ctx.stores.events.history()
 */

import { WORKFLOW_CONFIG, EVENT_TYPE_WEIGHTS, ENTITY_WEIGHTS } from '../config.mjs'

export function createDedupDomain(ctx) {
  // ── 工具函数（从 dedup.mjs 迁移）──

  function extractKeywords(title) {
    const t = title.replace(/[\s\-_|·：:，,。.！!？?""''「」【】《》()（）]/g, '')
    const enWords = (t.match(/[a-zA-Z][a-zA-Z0-9.]+/g) || []).map((w) => w.toLowerCase())
    const zhChars = t.replace(/[^一-鿿]/g, '')
    const zhBigrams = []
    for (let i = 0; i < zhChars.length - 1; i++) {
      zhBigrams.push(zhChars.slice(i, i + 2))
    }
    return new Set([...enWords, ...zhBigrams])
  }

  function computeTitleSimilarity(titleA, titleB) {
    const kwA = extractKeywords(titleA)
    const kwB = extractKeywords(titleB)
    if (kwA.size === 0 || kwB.size === 0) return 0
    const intersection = new Set([...kwA].filter((x) => kwB.has(x)))
    return intersection.size / Math.min(kwA.size, kwB.size)
  }

  function extractEventFingerprint(title, publishedAt) {
    const lower = title.toLowerCase()

    const entities = []
    for (const tier of Object.values(ENTITY_WEIGHTS)) {
      if (!tier.entities) continue
      for (const entity of tier.entities) {
        if (lower.includes(entity.toLowerCase())) entities.push(entity)
      }
    }

    let eventType = 'general'
    let maxScore = 0
    for (const [type, config] of Object.entries(EVENT_TYPE_WEIGHTS)) {
      if (type === 'general') continue
      let matched = false
      if (config.keywords) matched = config.keywords.some((kw) => lower.includes(kw.toLowerCase()))
      if (!matched && config.regex) matched = config.regex.test(title)
      if (matched && config.score > maxScore) { eventType = type; maxScore = config.score }
    }

    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'with', '的', '了', '在', '是', '和', '与'])
    const words = extractKeywords(title)
    const keywords = [...words].filter((w) => !stopWords.has(w) && w.length > 1).slice(0, 3)

    let dateBucket = 'unknown'
    if (publishedAt) {
      const d = new Date(publishedAt)
      const jan1 = new Date(d.getFullYear(), 0, 1)
      const dayOfYear = Math.floor((d - jan1) / 86400000) + 1
      const weekNum = Math.ceil(dayOfYear / 7)
      dateBucket = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
    }

    const entityStr = entities.length > 0 ? entities.sort().join('+') : 'unknown'
    return `${entityStr}|${eventType}|${keywords.join(',')}|${dateBucket}`
  }

  function isDuplicate(newItem, historicalItems, titleThreshold = 0.5) {
    for (const existing of historicalItems) {
      // Level 1: URL 精确匹配
      if (newItem.url && existing.url && newItem.url === existing.url) {
        return { isDup: true, reason: 'url_exact_match', level: 1, matched: existing }
      }

      // Level 2: 事件指纹匹配
      const newItemPublishedAt = newItem.publishedAt || newItem.sources?.[0]?.publishedAt || newItem.timeline?.collected
      const existingPublishedAt = existing.publishedAt || existing.sources?.[0]?.publishedAt || existing.timeline?.collected
      const newFp = extractEventFingerprint(newItem.title, newItemPublishedAt)
      const existingFp = extractEventFingerprint(existing.title, existingPublishedAt)
      if (newFp === existingFp) {
        return { isDup: true, reason: `event_fingerprint: ${newFp}`, level: 2, matched: existing }
      }

      // Level 3: 标题 bigram 相似度
      const sim = computeTitleSimilarity(newItem.title, existing.title || '')
      if (sim >= titleThreshold) {
        return { isDup: true, reason: `title_similarity: ${sim.toFixed(2)}`, level: 3, matched: existing }
      }
    }
    return { isDup: false }
  }

  // ── 核心接口 ──

  return {
    async run(events) {
      const lookbackDays = WORKFLOW_CONFIG.dedupDays || 14
      const historicalEvents = await ctx.stores.events.history(lookbackDays)

      const kept = []
      const removed = []

      for (const event of events) {
        const result = isDuplicate(event, historicalEvents)
        if (result.isDup) {
          removed.push({
            id: event.id,
            title: event.title,
            score: event.rank?.totalScore,
            reason: result.reason,
            matched_title: result.matched?.title,
          })
        } else {
          kept.push(event)
        }
      }

      return { kept, removed, historicalCount: historicalEvents.length }
    },
  }
}
