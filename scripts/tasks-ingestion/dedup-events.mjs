/**
 * DedupEvents Task — content_hash + 事件指纹 + 标题相似度
 */

import { ExecutionResult } from '../runtime/result.mjs'

export class DedupEvents {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const assets = ctx._assets || []
    const repo = ctx.scope.events.repository

    // 基于 content_hash 的去重（SQLite UNIQUE 约束处理）
    // 这里做内存级预过滤，减少写入时的冲突
    const seen = new Set()
    const unique = []
    let hashDeduped = 0

    for (const asset of assets) {
      if (asset.contentHash && seen.has(asset.contentHash)) {
        hashDeduped++
        continue
      }
      if (asset.contentHash) seen.add(asset.contentHash)
      unique.push(asset)
    }

    ctx._assets = unique

    return ExecutionResult.ok(
      { unique: unique.length },
      { input: assets.length, hash_deduped: hashDeduped, output: unique.length }
    )
  }
}
