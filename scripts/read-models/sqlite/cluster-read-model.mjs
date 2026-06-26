/**
 * SQLite Cluster Read Model — 读模型
 * 查询 event_clusters 表
 */

export function createSqliteClusterReadModel(db) {
  const findAllStmt = db.prepare('SELECT * FROM event_clusters ORDER BY last_updated DESC')
  const findByIdStmt = db.prepare('SELECT * FROM event_clusters WHERE id = ?')
  const findByEntityStmt = db.prepare(
    "SELECT * FROM event_clusters WHERE entity_keys LIKE ? ORDER BY last_updated DESC"
  )
  const findByDateRangeStmt = db.prepare(
    'SELECT * FROM event_clusters WHERE first_seen >= ? AND first_seen <= ? ORDER BY first_seen DESC'
  )

  return {
    findAll() {
      return findAllStmt.all().map(parseRow)
    },

    findById(id) {
      const row = findByIdStmt.get(id)
      return row ? parseRow(row) : null
    },

    findByEntity(entity) {
      return findByEntityStmt.all(`%${entity}%`).map(parseRow)
    },

    findByDateRange(from, to) {
      return findByDateRangeStmt.all(from, to).map(parseRow)
    },
  }
}

function parseRow(row) {
  return {
    ...row,
    entity_keys: tryParse(row.entity_keys, []),
    topic_keys: tryParse(row.topic_keys, []),
    metadata: tryParse(row.metadata, {}),
  }
}

function tryParse(str, fallback) {
  try { return JSON.parse(str) } catch { return fallback }
}
