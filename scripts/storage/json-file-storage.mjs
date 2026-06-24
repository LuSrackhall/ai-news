/**
 * JsonFileStorage — JSON 文件存储实现
 * output/<date>/ 目录
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export function createJsonFileStorage(date, workspace = '.', outputDir = 'output') {
  const baseDir = join(workspace, outputDir, date)

  return {
    read(key) {
      try {
        return JSON.parse(readFileSync(join(baseDir, `${key}.json`), 'utf-8'))
      } catch {
        return null
      }
    },

    write(key, data) {
      mkdirSync(baseDir, { recursive: true })
      writeFileSync(join(baseDir, `${key}.json`), JSON.stringify(data, null, 2))
    },

    exists(key) {
      return existsSync(join(baseDir, `${key}.json`))
    },

    readDay(key, dateStr) {
      try {
        return JSON.parse(readFileSync(join(workspace, outputDir, dateStr, `${key}.json`), 'utf-8'))
      } catch {
        return null
      }
    },
  }
}
