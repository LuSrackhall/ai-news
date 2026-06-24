/**
 * EventFingerprintRule — 事件指纹匹配
 * Entity|EventType|TopKeywords|Week 指纹
 */

import { ENTITY_WEIGHTS, EVENT_TYPE_WEIGHTS } from '../config.mjs'

export class EventFingerprintRule {
  name = 'eventFingerprint'

  evaluate({ titleA, publishedAtA, titleB, publishedAtB }) {
    const fpA = this.extract(titleA, publishedAtA)
    const fpB = this.extract(titleB, publishedAtB)
    return { duplicate: fpA === fpB, fingerprintA: fpA, fingerprintB: fpB }
  }

  extract(title, publishedAt) {
    const lower = (title || '').toLowerCase()

    const entities = []
    for (const tier of Object.values(ENTITY_WEIGHTS)) {
      if (!tier.entities) continue
      for (const entity of tier.entities) {
        if (lower.includes(entity.toLowerCase())) entities.push(entity)
      }
    }

    let eventType = 'general', maxScore = 0
    for (const [type, config] of Object.entries(EVENT_TYPE_WEIGHTS)) {
      if (type === 'general') continue
      let matched = false
      if (config.keywords) matched = config.keywords.some((kw) => lower.includes(kw.toLowerCase()))
      if (!matched && config.regex) matched = config.regex.test(title)
      if (matched && config.score > maxScore) { eventType = type; maxScore = config.score }
    }

    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'with', '的', '了', '在', '是', '和', '与'])
    const t = (title || '').replace(/[\s\-_|·：:，,。.！!？?""''「」【】《》()（）]/g, '')
    const enWords = (t.match(/[a-zA-Z][a-zA-Z0-9.]+/g) || []).map((w) => w.toLowerCase())
    const zhChars = t.replace(/[^一-鿿]/g, '')
    const zhBigrams = []
    for (let i = 0; i < zhChars.length - 1; i++) zhBigrams.push(zhChars.slice(i, i + 2))
    const allWords = [...new Set([...enWords, ...zhBigrams])].filter((w) => !stopWords.has(w) && w.length > 1).slice(0, 3)

    let dateBucket = 'unknown'
    if (publishedAt) {
      const d = new Date(publishedAt)
      const jan1 = new Date(d.getFullYear(), 0, 1)
      const dayOfYear = Math.floor((d - jan1) / 86400000) + 1
      const weekNum = Math.ceil(dayOfYear / 7)
      dateBucket = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
    }

    const entityStr = entities.length > 0 ? entities.sort().join('+') : 'unknown'
    return `${entityStr}|${eventType}|${allWords.join(',')}|${dateBucket}`
  }
}
