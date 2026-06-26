/**
 * SQLite Event ReadModel — 读模型
 * 只负责查询，不承担写操作
 */

export function createSqliteEventReadModel(db) {
  function fromRow(row) {
    if (!row) return null
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      summary: row.summary,
      url: row.url,
      contentHash: row.content_hash,
      publishedAt: row.published_at,
      collectedAt: row.collected_at,
      effectiveAt: row.effective_at,
      timePrecision: row.time_precision,
      rank: row.rank_total != null ? {
        totalScore: row.rank_total,
        tierLabel: row.rank_tier,
      } : null,
      curation: row.curation_importance ? {
        importance: row.curation_importance,
        note: row.curation_note,
      } : null,
      source: {
        name: row.source_name,
        tier: row.source_tier,
        url: row.source_url,
      },
      sourceId: row.source_id,
      entities: JSON.parse(row.entities || '[]'),
      topics: JSON.parse(row.topics || '[]'),
      clusterId: row.cluster_id,
      assetIds: JSON.parse(row.asset_ids || '[]'),
      metadata: JSON.parse(row.metadata || '{}'),
    }
  }

  return {
    load() {
      return db.prepare('SELECT * FROM events ORDER BY rank_total DESC').all().map(fromRow)
    },

    findByWindow(from, to) {
      return db.prepare(
        'SELECT * FROM events WHERE effective_at >= ? AND effective_at < ? ORDER BY rank_total DESC'
      ).all(from, to).map(fromRow)
    },

    findByEntity(entity) {
      return db.prepare(
        'SELECT e.* FROM events e JOIN event_entities ee ON e.id = ee.event_id WHERE ee.entity = ? ORDER BY e.effective_at DESC'
      ).all(entity).map(fromRow)
    },

    findByTopic(topic) {
      return db.prepare(
        'SELECT e.* FROM events e JOIN event_topics et ON e.id = et.event_id WHERE et.topic = ? ORDER BY e.effective_at DESC'
      ).all(topic).map(fromRow)
    },

    existsByHash(hash) {
      return db.prepare('SELECT 1 FROM events WHERE content_hash = ?').get(hash) !== undefined
    },

    findByCluster(clusterId) {
      return db.prepare(
        'SELECT * FROM events WHERE cluster_id = ? ORDER BY rank_total DESC'
      ).all(clusterId).map(fromRow)
    },

    count() {
      return db.prepare('SELECT COUNT(*) as count FROM events').get().count
    },
  }
}
