/**
 * EventTypeRule — 事件类型评分（Bonus）
 * 关键词/regex → bonus score
 */

import { EVENT_TYPE_WEIGHTS } from '../config.mjs'

export class EventTypeRule {
  name = 'eventType'

  evaluate(asset) {
    const text = `${asset.title || ''} ${asset.description || ''} ${asset.summary || ''}`
    const lower = text.toLowerCase()
    let maxScore = EVENT_TYPE_WEIGHTS.general.score

    for (const [_, config] of Object.entries(EVENT_TYPE_WEIGHTS)) {
      if (config.score === 2) continue
      let matched = false
      if (config.keywords) matched = config.keywords.some((kw) => lower.includes(kw.toLowerCase()))
      if (!matched && config.regex) matched = config.regex.test(text)
      if (matched) maxScore = Math.max(maxScore, config.score)
    }
    return { type: 'bonus', score: Math.min(maxScore, 12) }
  }
}
