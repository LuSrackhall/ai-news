/**
 * SQLite 数据库初始化
 * 建表 + 索引 + WAL mode
 */

import Database from 'better-sqlite3'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

export function createSqliteDatabase(dbPath = null) {
  const path = dbPath || join('.', 'data', 'events.db')
  mkdirSync(join(path, '..'), { recursive: true })

  const db = new Database(path)

  // WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // 建表
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id            TEXT PRIMARY KEY,
      type          TEXT NOT NULL DEFAULT 'news',
      title         TEXT NOT NULL,
      summary       TEXT,
      url           TEXT,
      content_hash  TEXT NOT NULL,

      -- 时间语义模型
      published_at  TEXT,
      collected_at  TEXT NOT NULL,
      effective_at  TEXT NOT NULL,
      time_precision TEXT NOT NULL DEFAULT 'unknown',

      -- 评分快照
      rank_total    REAL,
      rank_tier     TEXT,

      -- 来源
      source_name   TEXT,
      source_tier   INTEGER,
      source_url    TEXT,
      source_id     TEXT,

      -- 选题快照
      curation_importance TEXT,
      curation_note       TEXT,

      -- 实体与主题
      entities      TEXT DEFAULT '[]',
      topics        TEXT DEFAULT '[]',
      cluster_id    TEXT,

      -- 审计
      asset_ids     TEXT DEFAULT '[]',
      metadata      TEXT DEFAULT '{}',

      UNIQUE(content_hash)
    );

    CREATE TABLE IF NOT EXISTS event_entities (
      event_id  TEXT NOT NULL REFERENCES events(id),
      entity    TEXT NOT NULL,
      PRIMARY KEY (event_id, entity)
    );

    CREATE TABLE IF NOT EXISTS event_topics (
      event_id  TEXT NOT NULL REFERENCES events(id),
      topic     TEXT NOT NULL,
      PRIMARY KEY (event_id, topic)
    );

    CREATE INDEX IF NOT EXISTS idx_events_effective ON events(effective_at);
    CREATE INDEX IF NOT EXISTS idx_events_published ON events(published_at);
    CREATE INDEX IF NOT EXISTS idx_events_rank ON events(rank_tier, rank_total);
    CREATE INDEX IF NOT EXISTS idx_events_source ON events(source_name);
    CREATE INDEX IF NOT EXISTS idx_events_source_id ON events(source_id);
    CREATE INDEX IF NOT EXISTS idx_events_cluster ON events(cluster_id);
  `)

  return db
}
