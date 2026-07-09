/**
 * provenance-service.mjs — 证据血缘查询服务
 *
 * 提供 Publisher Resolution、Trust Score 查询接口。
 * 被 Judgment Engine 的 prioritization signals 消费。
 */

export function createProvenanceService(db) {
  if (!db) return null

  /**
   * 查询 publisher 的规范化名称、类型和信任分
   * @param {string} sourceId — RSS 源 ID（如 'techcrunch', '36kr'）
   * @returns {{ canonical: string, publisherType: string, trustScore: number } | null}
   */
  function resolvePublisher(sourceId) {
    if (!sourceId) return null
    try {
      const row = db.prepare(
        'SELECT canonical, publisher_type, trust_score FROM provenance_aliases WHERE alias = ?'
      ).get(sourceId.toLowerCase())
      if (!row) return null
      return { canonical: row.canonical, publisherType: row.publisher_type, trustScore: row.trust_score }
    } catch { return null }
  }

  /**
   * 批量查询 publisher 信息
   * @param {string[]} sourceIds
   * @returns {Map<string, Object>}
   */
  function resolvePublishers(sourceIds) {
    const map = new Map()
    for (const id of sourceIds) {
      const result = resolvePublisher(id)
      if (result) map.set(id, result)
    }
    return map
  }

  return { resolvePublisher, resolvePublishers }
}
