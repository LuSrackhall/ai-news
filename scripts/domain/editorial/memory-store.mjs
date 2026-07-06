/**
 * SqliteMemoryStore — 编辑记忆层
 *
 * Architecture Constitution v1.0 约束：
 * - Advisory Only：不参与决策
 * - Storage Agnostic：实现可替换
 *
 * Memory Store 提供：
 * - Story Tracking：跟踪事件发展脉络
 * - Editorial History：已报道事件存档
 * - Story Lifecycle：生命周期状态管理
 * - Rejected Events Log：被拒绝事件的可追溯记录
 *
 * 降级语义：
 * - 所有公共方法在失败时返回空/默认值
 * - 不向外层调用者抛出异常
 */

import Database from 'better-sqlite3'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { existsSync } from 'node:fs'

const DEFAULT_DB_PATH = join('.', 'data', 'editorial-memory.db')

/**
 * Story lifecycle state enum
 */
export const STORY_STATES = {
  EMERGING: 'emerging',
  DEVELOPING: 'developing',
  PEAK: 'peak',
  FOLLOW_UP: 'follow-up',
  STALE: 'stale',
}

/**
 * Rejection type enum
 */
export const REJECTION_TYPES = {
  HARD: 'hard',
  CONTEXTUAL: 'contextual',
}

export class SqliteMemoryStore {
  /**
   * @param {string} [dbPath] — SQLite 文件路径
   */
  constructor(dbPath = null) {
    this._path = dbPath || DEFAULT_DB_PATH
    this._db = null
    this._connect()
  }

  // ───────── 初始化 ─────────

  _connect() {
    try {
      mkdirSync(join(this._path, '..'), { recursive: true })
      this._db = new Database(this._path)
      this._db.pragma('journal_mode = WAL')
      this._initSchema()
    } catch {
      // 降级：连接失败时 this._db 保持 null
    }
  }

  _initSchema() {
    if (!this._db) return
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS stories (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        story_key  TEXT NOT NULL,
        entity     TEXT,
        title      TEXT,
        first_seen TEXT NOT NULL,
        last_seen  TEXT NOT NULL,
        event_ids  TEXT NOT NULL DEFAULT '[]',
        state      TEXT NOT NULL DEFAULT 'emerging',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(story_key)
      );

      CREATE INDEX IF NOT EXISTS idx_stories_entity ON stories(entity);
      CREATE INDEX IF NOT EXISTS idx_stories_last_seen ON stories(last_seen);
      CREATE INDEX IF NOT EXISTS idx_stories_state ON stories(state);

      CREATE TABLE IF NOT EXISTS story_events (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        story_id   INTEGER NOT NULL REFERENCES stories(id),
        event_id   TEXT NOT NULL,
        event_title TEXT,
        event_date  TEXT NOT NULL,
        event_url   TEXT,
        UNIQUE(story_id, event_id)
      );

      CREATE INDEX IF NOT EXISTS idx_story_events_event ON story_events(event_id);

      CREATE TABLE IF NOT EXISTS rejected_events (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id    TEXT NOT NULL,
        event_title TEXT,
        reason      TEXT NOT NULL,
        reject_type TEXT NOT NULL DEFAULT 'hard',
        source_name TEXT,
        rejected_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(event_id, reject_type, rejected_at)
      );

      CREATE INDEX IF NOT EXISTS idx_rejected_events_id ON rejected_events(event_id);

      CREATE TABLE IF NOT EXISTS day_snapshots (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        date         TEXT NOT NULL UNIQUE,
        top_event_ids TEXT NOT NULL DEFAULT '[]',
        top_entities TEXT NOT NULL DEFAULT '[]',
        top_categories TEXT NOT NULL DEFAULT '[]',
        created_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_day_snapshots_date ON day_snapshots(date);
    `)
  }

  // ───────── Connection 状态 ─────────

  get connected() { return this._db !== null }

  _ensureDb() {
    if (!this._db) return false
    try {
      this._db.prepare('SELECT 1').get()
      return true
    } catch {
      this._db = null
      return false
    }
  }

  // ───────── Story Tracking ─────────

  /**
   * 记录或更新一个事件在 Story 中的出现
   * @param {Object} info
   * @param {string} info.storyKey — 故事标识（如实体+主题的联合键）
   * @param {string} [info.entity] — 主要实体
   * @param {string} [info.title] — 事件标题
   * @param {string} info.eventId — 事件 ID
   * @param {string} info.date — ISO 日期
   * @param {string} [info.url] — 事件 URL
   * @returns {{storyId: number|null, isNew: boolean}}
   */
  trackStory(info) {
    if (!this._ensureDb()) return { storyId: null, isNew: false }

    try {
      const { storyKey, entity, title, eventId, date, url } = info
      let story = this._db.prepare('SELECT * FROM stories WHERE story_key = ?').get(storyKey)
      let isNew = false

      if (!story) {
        const res = this._db.prepare(
          `INSERT INTO stories (story_key, entity, title, first_seen, last_seen, event_ids, state)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(storyKey, entity || null, title || null, date, date, JSON.stringify([eventId]), 'emerging')
        story = this._db.prepare('SELECT * FROM stories WHERE id = ?').get(res.lastInsertRowid)
        isNew = true
      } else {
        const ids = JSON.parse(story.event_ids || '[]')
        if (!ids.includes(eventId)) ids.push(eventId)
        this._db.prepare(
          `UPDATE stories SET last_seen = ?, event_ids = ?, title = COALESCE(NULLIF(?, ''), title) WHERE id = ?`
        ).run(date, JSON.stringify(ids), title || null, story.id)
      }

      // 记录事件到 time-line
      this._db.prepare(
        `INSERT OR IGNORE INTO story_events (story_id, event_id, event_title, event_date, event_url)
         VALUES (?, ?, ?, ?, ?)`
      ).run(story.id, eventId, title || null, date, url || null)

      return { storyId: story.id, isNew }
    } catch {
      return { storyId: null, isNew: false }
    }
  }

  /**
   * 查询一个 Story 的时间线
   * @param {string} storyKey
   * @returns {Object|null} { story, timeline: Array }
   */
  queryStory(storyKey) {
    if (!this._ensureDb()) return null
    try {
      const story = this._db.prepare('SELECT * FROM stories WHERE story_key = ?').get(storyKey)
      if (!story) return null

      const timeline = this._db.prepare(
        'SELECT * FROM story_events WHERE story_id = ? ORDER BY event_date ASC'
      ).all(story.id)

      return { story, timeline }
    } catch {
      return null
    }
  }

  /**
   * 按实体查询相关 stories
   * @param {string} entity
   * @returns {Array}
   */
  queryStoriesByEntity(entity) {
    if (!this._ensureDb()) return []
    try {
      return this._db.prepare(
        'SELECT * FROM stories WHERE entity = ? ORDER BY last_seen DESC'
      ).all(entity)
    } catch {
      return []
    }
  }

  // ───────── Story Lifecycle ─────────

  /**
   * 获取一个 Story 的生命周期状态
   * @param {string} storyKey
   * @returns {Object|null} { state, ...story }
   */
  getStoryLifecycle(storyKey) {
    if (!this._ensureDb()) return null
    try {
      const story = this._db.prepare('SELECT * FROM stories WHERE story_key = ?').get(storyKey)
      if (!story) return null
      return { state: story.state, ...story }
    } catch {
      return null
    }
  }

  /**
   * 更新 Story 生命周期状态
   * @param {string} storyKey
   * @param {string} state — STORY_STATES 中的值
   * @returns {boolean}
   */
  updateStoryLifecycle(storyKey, state) {
    if (!this._ensureDb()) return false
    try {
      const res = this._db.prepare('UPDATE stories SET state = ? WHERE story_key = ?').run(state, storyKey)
      return res.changes > 0
    } catch {
      return false
    }
  }

  // ───────── Rejected Events Log ─────────

  /**
   * 记录一个被拒绝的事件
   * @param {Object} info
   * @param {string} info.eventId
   * @param {string} [info.eventTitle]
   * @param {string} info.reason
   * @param {'hard'|'contextual'} info.rejectType
   * @param {string} [info.sourceName]
   * @returns {boolean}
   */
  logRejectedEvent(info) {
    if (!this._ensureDb()) return false
    try {
      this._db.prepare(
        `INSERT INTO rejected_events (event_id, event_title, reason, reject_type, source_name)
         VALUES (?, ?, ?, ?, ?)`
      ).run(info.eventId, info.eventTitle || null, info.reason, info.rejectType, info.sourceName || null)
      return true
    } catch {
      return false
    }
  }

  /**
   * 查询一个事件被拒绝的历史记录
   * @param {string} eventId
   * @returns {Array}
   */
  getRejectionHistory(eventId) {
    if (!this._ensureDb()) return []
    try {
      return this._db.prepare(
        'SELECT * FROM rejected_events WHERE event_id = ? ORDER BY rejected_at DESC'
      ).all(eventId)
    } catch {
      return []
    }
  }

  // ───────── Editorial History ─────────

  /**
   * 保存单日快照
   * @param {string} date — ISO 日期
   * @param {Object} snapshot
   * @param {string[]} [snapshot.topEventIds]
   * @param {string[]} [snapshot.topEntities]
   * @param {string[]} [snapshot.topCategories]
   * @returns {boolean}
   */
  saveDaySnapshot(date, snapshot) {
    if (!this._ensureDb()) return false
    try {
      this._db.prepare(
        `INSERT OR REPLACE INTO day_snapshots (date, top_event_ids, top_entities, top_categories)
         VALUES (?, ?, ?, ?)`
      ).run(
        date,
        JSON.stringify(snapshot.topEventIds || []),
        JSON.stringify(snapshot.topEntities || []),
        JSON.stringify(snapshot.topCategories || []),
      )
      return true
    } catch {
      return false
    }
  }

  /**
   * 查询指定日期之后的快照
   * @param {string} since — ISO 日期
   * @returns {Array}
   */
  loadDaySnapshots(since) {
    if (!this._ensureDb()) return []
    try {
      return this._db.prepare(
        'SELECT * FROM day_snapshots WHERE date >= ? ORDER BY date ASC'
      ).all(since)
    } catch {
      return []
    }
  }

  /**
   * 查询某个事件是否在历史报道中出现过
   * @param {string} eventId
   * @returns {number} — 出现天数
   */
  getCoverageCount(eventId) {
    if (!this._ensureDb()) return 0
    try {
      const row = this._db.prepare(
        `SELECT COUNT(*) as cnt FROM day_snapshots
         WHERE json_valid(top_event_ids) AND top_event_ids LIKE ?`
      ).get(`%${eventId}%`)
      return row ? row.cnt : 0
    } catch {
      return 0
    }
  }

  // ───────── 清理 ─────────

  /**
   * 删除指定日期之前的快照
   * @param {string} before — ISO 日期
   */
  prune(before) {
    if (!this._ensureDb()) return
    try {
      this._db.prepare('DELETE FROM day_snapshots WHERE date < ?').run(before)
    } catch { /* 静默失败 */ }
  }

  /**
   * 关闭数据库连接
   */
  close() {
    try {
      if (this._db) this._db.close()
    } catch { /* 静默 */ }
  }
}

/**
 * 创建 Memory Store（工厂函数，支持降级）
 * @param {string} [dbPath]
 * @returns {SqliteMemoryStore}
 */
export function createMemoryStore(dbPath = null) {
  return new SqliteMemoryStore(dbPath)
}
