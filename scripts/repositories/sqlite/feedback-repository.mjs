/**
 * SQLite Feedback Repository — 写模型
 * 写入 feedback 表
 */

import { randomUUID } from 'node:crypto'

export function createSqliteFeedbackRepository(db) {
  const insertStmt = db.prepare(`
    INSERT INTO feedback (id, event_id, cluster_id, type, value, source, created_at)
    VALUES (@id, @event_id, @cluster_id, @type, @value, @source, @created_at)
  `)

  return {
    store({ eventId, clusterId, type, value, source = 'unknown' }) {
      return insertStmt.run({
        id: randomUUID(),
        event_id: eventId || null,
        cluster_id: clusterId || null,
        type,
        value,
        source,
        created_at: new Date().toISOString(),
      }).changes
    },
  }
}
