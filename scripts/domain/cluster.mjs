/**
 * ClusterPolicy — 事件聚类策略（纯计算，无 IO）
 *
 * 三重匹配条件（满足任一即归为同一 Cluster）：
 *   1. 实体重叠度 ≥ 0.5（交集 / 并集）
 *   2. 事件指纹相同（Entity|EventType|Keywords|Week）
 *   3. 标题 bigram 相似度 ≥ 0.7
 */

export class ClusterPolicy {
  /**
   * 判断两个事件是否应归为同一 Cluster
   * @param {object} eventA - { entities: string[], eventType: string, keywords: string[], title: string, weekKey: string }
   * @param {object} eventB
   * @returns {{ match: boolean, reason: string }}
   */
  match(eventA, eventB) {
    // 条件 1: 实体重叠度
    const overlap = this.entityOverlap(eventA.entities, eventB.entities)
    if (overlap >= 0.5) {
      return { match: true, reason: `entity_overlap=${overlap.toFixed(2)}` }
    }

    // 条件 2: 事件指纹
    if (this.fingerprint(eventA) === this.fingerprint(eventB)) {
      return { match: true, reason: 'fingerprint' }
    }

    // 条件 3: 标题相似度
    const similarity = this.titleSimilarity(eventA.title, eventB.title)
    if (similarity >= 0.7) {
      return { match: true, reason: `title_similarity=${similarity.toFixed(2)}` }
    }

    return { match: false, reason: null }
  }

  /**
   * 实体重叠度 = |intersection| / |union|
   */
  entityOverlap(a, b) {
    if (!a?.length || !b?.length) return 0
    const setA = new Set(a.map(e => e.toLowerCase()))
    const setB = new Set(b.map(e => e.toLowerCase()))
    const intersection = [...setA].filter(x => setB.has(x))
    const union = new Set([...setA, ...setB])
    return union.size === 0 ? 0 : intersection.length / union.size
  }

  /**
   * 事件指纹: SHA-256(Entity|EventType|Keywords|Week)
   */
  fingerprint(event) {
    const sortedEntities = (event.entities || []).sort().join(',')
    const sortedKeywords = (event.keywords || []).sort().join(',')
    const raw = `${sortedEntities}|${event.eventType || ''}|${sortedKeywords}|${event.weekKey || ''}`
    return simpleHash(raw)
  }

  /**
   * 标题 bigram 相似度
   */
  titleSimilarity(a, b) {
    if (!a || !b) return 0
    const bigramsA = bigrams(a.toLowerCase())
    const bigramsB = bigrams(b.toLowerCase())
    if (bigramsA.size === 0 || bigramsB.size === 0) return 0
    const intersection = [...bigramsA].filter(x => bigramsB.has(x))
    const union = new Set([...bigramsA, ...bigramsB])
    return union.size === 0 ? 0 : intersection.length / union.size
  }

  /**
   * 从事件列表中选出标题最优的事件作为 Cluster 标题
   * （rank_total 最高，如无评分则取第一个）
   */
  pickClusterTitle(events) {
    if (!events?.length) return ''
    const scored = events.filter(e => e.rank_total != null)
    if (scored.length > 0) {
      scored.sort((a, b) => (b.rank_total || 0) - (a.rank_total || 0))
      return scored[0].title
    }
    return events[0].title
  }

  /**
   * 生成周键（ISO 周: YYYY-Www）
   */
  weekKey(date) {
    const d = new Date(date)
    const jan1 = new Date(d.getFullYear(), 0, 1)
    const days = Math.floor((d - jan1) / 86400000)
    const week = Math.ceil((days + jan1.getDay() + 1) / 7)
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
  }
}

/**
 * 生成 bigram 集合
 */
function bigrams(str) {
  const result = new Set()
  for (let i = 0; i < str.length - 1; i++) {
    result.add(str.slice(i, i + 2))
  }
  return result
}

/**
 * 简单哈希（非密码学，用于指纹比较）
 */
function simpleHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return String(hash)
}
