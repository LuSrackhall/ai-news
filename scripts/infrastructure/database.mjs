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

    -- v4.4: 事件聚类表
    CREATE TABLE IF NOT EXISTS event_clusters (
      id            TEXT PRIMARY KEY,
      title         TEXT NOT NULL,
      type          TEXT NOT NULL DEFAULT 'auto',
      importance    TEXT NOT NULL DEFAULT 'medium',
      event_count   INTEGER NOT NULL DEFAULT 0,
      entity_keys   TEXT NOT NULL DEFAULT '[]',
      topic_keys    TEXT NOT NULL DEFAULT '[]',
      first_seen    TEXT NOT NULL,
      last_updated  TEXT NOT NULL,
      metadata      TEXT DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_clusters_type ON event_clusters(type);
    CREATE INDEX IF NOT EXISTS idx_clusters_importance ON event_clusters(importance);
    CREATE INDEX IF NOT EXISTS idx_clusters_first_seen ON event_clusters(first_seen);

    -- v4.4: 周报表
    CREATE TABLE IF NOT EXISTS weekly_reports (
      id            TEXT PRIMARY KEY,
      week_start    TEXT NOT NULL,
      week_end      TEXT NOT NULL,
      cluster_count INTEGER NOT NULL DEFAULT 0,
      event_count   INTEGER NOT NULL DEFAULT 0,
      article_chars INTEGER NOT NULL DEFAULT 0,
      script_chars  INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL,
      metadata      TEXT DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_weekly_week ON weekly_reports(week_start, week_end);

    -- v4.4: 反馈表
    CREATE TABLE IF NOT EXISTS feedback (
      id            TEXT PRIMARY KEY,
      event_id      TEXT REFERENCES events(id),
      cluster_id    TEXT REFERENCES event_clusters(id),
      type          TEXT NOT NULL,
      value         REAL NOT NULL,
      source        TEXT NOT NULL DEFAULT 'unknown',
      created_at    TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_feedback_event ON feedback(event_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_cluster ON feedback(cluster_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(type);
    CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at);
  `)

  return db
}
