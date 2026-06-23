/**
 * ArtifactStore — Repository 语义的 Artifact 数据访问
 * v4.0 实现：JSON 文件（output/<date>/artifacts.json）
 * 按 type（article/script）存储和读取
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export function createArtifactStore(environment) {
  function getPath() {
    return join(environment.workspace, environment.config.outputDir, environment.date, 'artifacts.json')
  }

  function loadAll() {
    try {
      return JSON.parse(readFileSync(getPath(), 'utf-8'))
    } catch {
      return {}
    }
  }

  return {
    save(type, artifact) {
      const all = loadAll()
      all[type] = artifact
      const path = getPath()
      mkdirSync(join(path, '..'), { recursive: true })
      writeFileSync(path, JSON.stringify(all, null, 2))
    },

    load(type) {
      const all = loadAll()
      return all[type] || null
    },

    loadMarkdown(type) {
      const artifact = this.load(type)
      return artifact?.rendered?.markdown || null
    },
  }
}
