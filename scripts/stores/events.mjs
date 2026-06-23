/**
 * EventStore — Repository 语义的 Event 数据访问
 * v4.0 实现：JSON 文件（output/<date>/events.json）
 * history() 支持 v3 格式自动检测和转换
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { adaptV3CuratedToEvents } from '../engine/adapters/v3-compat.mjs'

export function createEventStore(environment) {
  function getPath(date) {
    return join(environment.workspace, environment.config.outputDir, date || environment.date, 'events.json')
  }

  function getV3Path(date) {
    return join(environment.workspace, environment.config.outputDir, date, 'curated.json')
  }

  function getV3CandidatesPath(date) {
    return join(environment.workspace, environment.config.outputDir, date, 'candidates.json')
  }

  /**
   * 加载某天的 Event 数据，自动检测 v3/v4 格式
   */
  function loadDay(date) {
    // v4 格式优先
    const v4Path = getPath(date)
    if (existsSync(v4Path)) {
      try {
        const data = JSON.parse(readFileSync(v4Path, 'utf-8'))
        return Array.isArray(data) ? data : []
      } catch { return [] }
    }

    // v3 格式 fallback（curated.json）
    const v3Path = getV3Path(date)
    if (existsSync(v3Path)) {
      try {
        const v3Data = JSON.parse(readFileSync(v3Path, 'utf-8'))
        return adaptV3CuratedToEvents(v3Data)
      } catch { return [] }
    }

    return []
  }

  return {
    save(events) {
      const path = getPath()
      mkdirSync(join(path, '..'), { recursive: true })
      writeFileSync(path, JSON.stringify(events, null, 2))
    },

    load() {
      return loadDay(environment.date)
    },

    /**
     * 加载最近 N 天的 Event 历史（含当天）
     * 用于 dedup 的历史比对
     */
    history(days) {
      const events = []
      const baseDate = new Date(environment.date + 'T00:00:00Z')

      for (let i = 0; i < days; i++) {
        const d = new Date(baseDate)
        d.setUTCDate(d.getUTCDate() - i)
        const dateStr = d.toISOString().slice(0, 10)
        events.push(...loadDay(dateStr))
      }

      return events
    },
  }
}
