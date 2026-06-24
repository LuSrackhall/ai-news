/**
 * DedupPolicy — 去重
 * 组合 TitleSimilarityRule + EventFingerprintRule
 * 接收预组装数据（today + history），只做纯计算
 */

export class DedupPolicy {
  constructor(titleSimilarityRule, eventFingerprintRule) {
    this.titleRule = titleSimilarityRule
    this.fingerprintRule = eventFingerprintRule
  }

  execute({ today, history }) {
    const kept = []
    const removed = []

    for (const event of today) {
      const dup = this.isDuplicate(event, history)
      if (dup.isDup) {
        removed.push({ id: event.id, title: event.title, score: event.rank?.totalScore, reason: dup.reason })
      } else {
        kept.push(event)
      }
    }

    return { kept, removed }
  }

  isDuplicate(event, historicalEvents) {
    for (const existing of historicalEvents) {
      // Level 1: URL 精确匹配
      if (event.url && existing.url && event.url === existing.url) {
        return { isDup: true, reason: 'url_exact_match' }
      }

      // Level 2: 事件指纹
      const eventPublishedAt = event.sources?.[0]?.publishedAt || event.publishedAt
      const existingPublishedAt = existing.sources?.[0]?.publishedAt || existing.publishedAt || existing.published_at
      const fpResult = this.fingerprintRule.evaluate({
        titleA: event.title, publishedAtA: eventPublishedAt,
        titleB: existing.title, publishedAtB: existingPublishedAt,
      })
      if (fpResult.duplicate) return { isDup: true, reason: `event_fingerprint: ${fpResult.fingerprintA}` }

      // Level 3: 标题相似度
      const simResult = this.titleRule.evaluate({ titleA: event.title, titleB: existing.title || '' })
      if (simResult.duplicate) return { isDup: true, reason: `title_similarity: ${simResult.similarity.toFixed(2)}` }
    }
    return { isDup: false }
  }
}
