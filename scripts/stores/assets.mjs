/**
 * AssetStore — Repository 语义的 Asset 数据访问
 * v4.0 实现：JSON 文件（output/<date>/assets.json）
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export function createAssetStore(environment) {
  function getPath() {
    return join(environment.workspace, environment.config.outputDir, environment.date, 'assets.json')
  }

  return {
    save(items) {
      const path = getPath()
      mkdirSync(join(path, '..'), { recursive: true })
      writeFileSync(path, JSON.stringify(items, null, 2))
    },

    load() {
      try {
        return JSON.parse(readFileSync(getPath(), 'utf-8'))
      } catch {
        return []
      }
    },

    append(newItems) {
      const existing = this.load()
      this.save([...existing, ...newItems])
    },
  }
}
