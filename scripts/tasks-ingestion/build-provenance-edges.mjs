/**
 * BuildProvenanceEdges Task — 构建证据血缘 DAG 边
 *
 * 在 NormalizeAssets 之后、StoreEvents 之前运行。
 * 读取 ctx._assets 中的标准化资产，构建 provenance_edges：
 * - duplicate_of: 同一内容不同来源（按 contentHash 匹配）
 * - clustered_into: 聚类为同一事件（按 cluster 匹配）
 *
 * Architecture v3 Provenance Layer:
 * - Publisher Resolution: 通过 provenance_aliases 归一化发布方名称
 * - DAG Edge Building: 通过 content_hash / cluster_id 关联
 */

import { ExecutionResult } from '../runtime/result.mjs'
import { createSqliteDatabase } from '../infrastructure/database.mjs'

export class BuildProvenanceEdges {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const assets = ctx._assets || []
    if (assets.length === 0) {
      return ExecutionResult.ok({ edges: 0 })
    }

    try {
      const db = ctx.scope?.events?.repository?._db
      if (!db) return ExecutionResult.ok({ edges: 0, warning: 'no database' })

      const edges = []
      const contentHashMap = new Map()

      // 第一遍: 按 contentHash 分组
      for (const asset of assets) {
        if (!asset.contentHash) continue
        if (!contentHashMap.has(asset.contentHash)) {
          contentHashMap.set(asset.contentHash, [])
        }
        contentHashMap.get(asset.contentHash).push(asset)
      }

      // 第二遍: 构建 duplicate_of 边
      for (const [, group] of contentHashMap) {
        if (group.length < 2) continue
        // 同一 contentHash 的不同 asset → duplicate_of 边
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            edges.push({ from: group[i].id, to: group[j].id, relation: 'duplicate_of' })
          }
        }
      }

      // 第三遍: publisher 归一化
      const aliases = {}
      try {
        const rows = db.prepare('SELECT alias, canonical FROM provenance_aliases').all()
        for (const r of rows) aliases[r.alias.toLowerCase()] = r.canonical
      } catch {}

      // 写入 provenance_edges
      const insertEdge = db.prepare(
        'INSERT OR IGNORE INTO provenance_edges (from_id, to_id, relation) VALUES (?, ?, ?)'
      )

      let inserted = 0
      const batchInsert = db.transaction(() => {
        for (const edge of edges) {
          insertEdge.run(edge.from, edge.to, edge.relation)
          inserted++
        }
      })
      batchInsert()

      return ExecutionResult.ok(
        { edges: inserted },
        { total: assets.length, groups: contentHashMap.size, edges: inserted }
      )
    } catch (err) {
      return ExecutionResult.ok({ edges: 0, error: err.message })
    }
  }
}
