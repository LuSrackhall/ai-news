/**
 * SQLite Event Repository — 写模型
 * INSERT OR IGNORE 基于 content_hash UNIQUE
 */

export function createSqliteEventRepository(db) {
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO events (
      id, type, title, summary, url, content_hash,
      published_at, collected_at, effective_at, time_precision,
      rank_total, rank_tier,
      source_name, source_tier, source_url, source_id,
      curation_importance, curation_note,
      entities, topics, cluster_id,
      asset_ids, metadata
    ) VALUES (
      @id, @type, @title, @summary, @url, @content_hash,
      @published_at, @collected_at, @effective_at, @time_precision,
      @rank_total, @rank_tier,
      @source_name, @source_tier, @source_url, @source_id,
      @curation_importance, @curation_note,
      @entities, @topics, @cluster_id,
      @asset_ids, @metadata
    )
  `)

  const insertEntityStmt = db.prepare(
    'INSERT OR IGNORE INTO event_entities (event_id, entity) VALUES (?, ?)'
  )

  const insertTopicStmt = db.prepare(
    'INSERT OR IGNORE INTO event_topics (event_id, topic) VALUES (?, ?)'
  )

  function toRow(event) {
    return {
      id: event.id,
      type: event.type || 'news',
      title: event.title,
      summary: event.summary || null,
      url: event.url || null,
      content_hash: event.contentHash || event.content_hash,
      published_at: event.publishedAt || event.published_at || null,
      collected_at: event.collectedAt || event.collected_at || new Date().toISOString(),
      effective_at: event.effectiveAt || event.effective_at || event.publishedAt || event.collectedAt || new Date().toISOString(),
      time_precision: event.timePrecision || event.time_precision || 'unknown',
      rank_total: event.rank?.totalScore ?? event.rank_total ?? null,
      rank_tier: event.rank?.tierLabel ?? event.rank_tier ?? null,
      source_name: event.source?.name || event.source_name || event.sourceName || null,
      source_tier: event.source?.tier ?? event.source_tier ?? event.sourceTier ?? null,
      source_url: event.source?.url || event.source_url || event.sourceUrl || null,
      source_id: event.sourceId || event.source_id || null,
      curation_importance: event.curation?.importance ?? event.curation_importance ?? null,
      curation_note: event.curation?.note ?? event.curation_note ?? null,
      entities: JSON.stringify(event.entities || []),
      topics: JSON.stringify(event.topics || []),
      cluster_id: event.clusterId || event.cluster_id || null,
      asset_ids: JSON.stringify(event.assetIds || []),
      metadata: JSON.stringify(event.metadata || {}),
    }
  }

  return {
    store(event) {
      const row = toRow(event)
      const result = insertStmt.run(row)
      // 写入实体关系表
      const entities = event.entities || []
      for (const entity of entities) {
        insertEntityStmt.run(event.id, entity)
      }
      // 写入主题关系表
      const topics = event.topics || []
      for (const topic of topics) {
        insertTopicStmt.run(event.id, topic)
      }
      return result.changes
    },

    storeBatch(events) {
      const tx = db.transaction((items) => {
        let inserted = 0
        for (const item of items) {
          inserted += this.store(item)
        }
        return inserted
      })
      return tx(events)
    },
  }
}
