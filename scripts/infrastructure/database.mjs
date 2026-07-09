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
    -- Provenance Layer v1: 证据血缘层
    CREATE TABLE IF NOT EXISTS provenance_assets (
      id TEXT PRIMARY KEY,
      content_hash TEXT NOT NULL,
      url TEXT NOT NULL,
      publisher TEXT NOT NULL,
      publisher_tier INTEGER,
      title TEXT,
      published_at TEXT,
      collected_at TEXT,
      author TEXT DEFAULT '',
      categories TEXT DEFAULT '',
      source_tag TEXT DEFAULT '',
      attribution_type TEXT DEFAULT 'raw_content',
      metadata TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS provenance_edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_id TEXT NOT NULL REFERENCES provenance_assets(id),
      to_id TEXT NOT NULL REFERENCES provenance_assets(id),
      relation TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(from_id, to_id, relation)
    );

    CREATE INDEX IF NOT EXISTS idx_prov_edges_from ON provenance_edges(from_id);
    CREATE INDEX IF NOT EXISTS idx_prov_edges_to ON provenance_edges(to_id);

    -- Provenance P1: Publisher 别名归一化
    CREATE TABLE IF NOT EXISTS provenance_aliases (
      alias TEXT PRIMARY KEY,
      canonical TEXT NOT NULL,
      publisher_type TEXT DEFAULT 'media',
      trust_score INTEGER DEFAULT 3
    );

    -- 预置已知别名映射
    INSERT OR IGNORE INTO provenance_aliases (alias, canonical, publisher_type, trust_score) VALUES
      ('techcrunch', 'TechCrunch', 'media', 4),
      ('theverge', 'The Verge', 'media', 4),
      ('wired', 'Wired', 'media', 4),
      ('arstechnica', 'Ars Technica', 'media', 4),
      ('semafor', 'Semafor', 'media', 3),
      ('axios', 'Axios', 'media', 4),
      ('mit-technology-review', 'MIT Technology Review', 'media', 4),
      ('simon-willison', 'Simon Willison Blog', 'personal', 3),
      ('lesswrong', 'LessWrong', 'community', 3),
      ('hacker-news', 'Hacker News', 'community', 2),
      ('arxiv-cs-ai', 'arXiv CS.AI', 'academic', 5),
      ('arxiv-cs-cl', 'arXiv CS.CL', 'academic', 5),
      ('openai', 'OpenAI', 'official', 5),
      ('anthropic', 'Anthropic', 'official', 5),
      ('google-ai', 'Google AI', 'official', 5),
      ('meta-ai', 'Meta AI', 'official', 5),
      ('nvidia', 'NVIDIA', 'official', 5),
      ('huggingface', 'HuggingFace', 'official', 5),
      ('aws-ml', 'AWS ML', 'official', 5),
      ('deepmind', 'DeepMind', 'official', 5),
      ('36kr', '36氪', 'media', 3),
      ('huxiu', '虎嗅', 'media', 3),
      ('qbitai', '量子位', 'media', 3);
    CREATE INDEX IF NOT EXISTS idx_prov_edges_to ON provenance_edges(to_id);


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

    -- v5.0: 隔离池（GitHub 噪音过滤被拦截的事件）
    CREATE TABLE IF NOT EXISTS quarantine (
      id              TEXT PRIMARY KEY,
      event_id        TEXT NOT NULL,
      source_id       TEXT,
      title           TEXT,
      url             TEXT,
      reason          TEXT,
      quarantined_at  TEXT NOT NULL,
      expires_at      TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_quarantine_source ON quarantine(source_id);
    CREATE INDEX IF NOT EXISTS idx_quarantine_expires ON quarantine(expires_at);
  `)

  return db
}
