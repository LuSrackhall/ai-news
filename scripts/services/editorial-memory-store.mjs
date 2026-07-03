/**
 * EditorialMemoryStore — 跨天报道记忆存储
 *
 * Architecture Constitution v1.0 不变量：
 * - Storage Agnostic：接口抽象，实现可替换
 * - ANNOTATION-only：不参与 ranking
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

const WORKSPACE = '.'
const DEFAULT_PATH = join(WORKSPACE, 'data', 'editorial-memory.json')

/**
 * @typedef {Object} DaySnapshot
 * @property {string[]} topEventIds — 当天 top 5 event id
 * @property {string[]} topEntities — 当天覆盖的主要实体
 * @property {string[]} topCategories — 当天覆盖的主题
 */

/**
 * @typedef {Object} MemorySnapshot
 * @property {Object<string, DaySnapshot>} days — date → DaySnapshot
 */

/**
 * JsonEditorialMemoryStore — Phase 1 默认实现
 * 使用 data/editorial-memory.json 单文件存储
 */
export class JsonEditorialMemoryStore {
  constructor(filePath = DEFAULT_PATH) {
    this._path = filePath
  }

  /**
   * 加载指定日期之后的 Memory
   * @param {string} since — ISO 日期字符串（如 "2026-06-26"）
   * @returns {MemorySnapshot}
   */
  load(since) {
    try {
      if (!existsSync(this._path)) return { days: {} }
      const raw = readFileSync(this._path, 'utf-8')
      const data = JSON.parse(raw)
      const days = data.days || {}

      // 只返回 since 及之后的 snapshot
      const filtered = {}
      for (const [date, snapshot] of Object.entries(days)) {
        if (date >= since) filtered[date] = snapshot
      }
      return { days: filtered }
    } catch {
      // 降级：文件损坏或格式错误时返回空
      return { days: {} }
    }
  }

  /**
   * 保存单日快照
   * @param {string} date — ISO 日期字符串
   * @param {DaySnapshot} snapshot
   */
  save(date, snapshot) {
    try {
      let data = { version: 1, days: {} }
      if (existsSync(this._path)) {
        try {
          data = JSON.parse(readFileSync(this._path, 'utf-8'))
          if (!data.days) data.days = {}
        } catch { /* 文件损坏，覆盖写入 */ }
      }

      data.days[date] = {
        topEventIds: snapshot.topEventIds || [],
        topEntities: snapshot.topEntities || [],
        topCategories: snapshot.topCategories || [],
      }

      mkdirSync(dirname(this._path), { recursive: true })
      writeFileSync(this._path, JSON.stringify(data, null, 2), 'utf-8')
    } catch {
      // 静默失败：Memory 不是关键路径
    }
  }

  /**
   * 清理 before 日期及之前的快照
   * @param {string} before — ISO 日期字符串
   */
  prune(before) {
    try {
      if (!existsSync(this._path)) return
      const data = JSON.parse(readFileSync(this._path, 'utf-8'))
      const days = data.days || {}

      for (const date of Object.keys(days)) {
        if (date <= before) delete days[date]
      }

      data.days = days
      writeFileSync(this._path, JSON.stringify(data, null, 2), 'utf-8')
    } catch { /* 静默失败 */ }
  }
}

/**
 * 空 MemorySnapshot 常量（load 降级用）
 */
export function emptyMemorySnapshot() {
  return { days: {} }
}
