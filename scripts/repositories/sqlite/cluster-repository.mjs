/**
 * SQLite Cluster Repository — 写模型
 * 写入 event_clusters 表
 */

export function createSqliteClusterRepository(db) {
  const upsertStmt = db.prepare(`
    INSERT OR REPLACE INTO event_clusters (
      id, title, type, importance, event_count,
      entity_keys, topic_keys, first_seen, last_updated, metadata
    ) VALUES (
      @id, @title, @type, @importance, @event_count,
      @entity_keys, @topic_keys, @first_seen, @last_updated, @metadata
    )
  `)

  return {
    store(cluster) {
      const row = toRow(cluster)
      return upsertStmt.run(row).changes
    },

    storeBatch(clusters) {
      const tx = db.transaction((items) => {
        let stored = 0
        for (const item of items) {
          stored += this.store(item)
        }
        return stored
      })
      return tx(clusters)
    },

    update(cluster) {
      return this.store(cluster) // INSERT OR REPLACE
    },
  }
}

function toRow(cluster) {
  return {
    id: cluster.id,
    title: cluster.title,
    type: cluster.type || 'auto',
    importance: cluster.importance || 'medium',
    event_count: cluster.event_count || cluster.eventCount || 0,
    entity_keys: typeof cluster.entity_keys === 'string'
      ? cluster.entity_keys
      : JSON.stringify(cluster.entity_keys || cluster.entityKeys || []),
    topic_keys: typeof cluster.topic_keys === 'string'
      ? cluster.topic_keys
      : JSON.stringify(cluster.topic_keys || cluster.topicKeys || []),
    first_seen: cluster.first_seen || cluster.firstSeen || new Date().toISOString(),
    last_updated: cluster.last_updated || cluster.lastUpdated || new Date().toISOString(),
    metadata: typeof cluster.metadata === 'string'
      ? cluster.metadata
      : JSON.stringify(cluster.metadata || {}),
  }
}
