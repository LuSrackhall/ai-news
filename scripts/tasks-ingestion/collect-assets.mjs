/**
 * CollectAssets Task — RSS 采集
 * 读 RSS feeds，产出 Asset[]
 */

import { ExecutionResult } from '../runtime/result.mjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export class CollectAssets {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const date = ctx.resources.date
    const result = await ctx.host.invoke(
      `运行命令: node scripts/collect-rss.mjs --date ${date}\n报告：成功采集了几个源、总共多少条新闻、失败了几个源。不要修改任何数据。`,
      {
        model: 'haiku',
        schema: {
          type: 'object',
          properties: {
            sources_ok: { type: 'number' },
            total_items: { type: 'number' },
            failures: { type: 'array', items: { type: 'string' } },
          },
          required: ['sources_ok', 'total_items'],
        },
      }
    )

    // 读取采集结果
    const rawPath = join('.', 'output', date, 'raw', 'all-raw.json')
    let assets = []
    try {
      assets = JSON.parse(readFileSync(rawPath, 'utf-8'))
    } catch {}

    // 存入 scope 供后续 Task 使用
    ctx._assets = assets

    if (result.total_items < 1) {
      return ExecutionResult.fatal('no_raw_items')
    }

    return ExecutionResult.ok(
      { assets_count: assets.length },
      { raw_count: result.total_items, sources_ok: result.sources_ok, failures: result.failures || [] }
    )
  }
}
