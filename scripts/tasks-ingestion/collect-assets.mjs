/**
 * CollectAssets Task — RSS 采集
 * 直接调用 collect-rss.mjs 脚本，不依赖 Host.invoke
 */

import { ExecutionResult } from '../runtime/result.mjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

export class CollectAssets {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const date = ctx.resources.date

    // 直接执行采集脚本
    const output = execSync(`node scripts/collect-rss.mjs --date ${date}`, {
      encoding: 'utf-8',
      timeout: 120_000,
      cwd: ctx.resources.workspace || '.',
    })

    // 解析 __SUMMARY_JSON__ 输出
    const match = output.match(/__SUMMARY_JSON__(.*?)__END__/s)
    let summary = {}
    if (match) {
      try { summary = JSON.parse(match[1]) } catch {}
    }

    const totalItems = summary.items?.raw || 0
    const sourcesOk = summary.sources?.ok || 0

    // 读取采集结果
    const rawPath = join(ctx.resources.workspace || '.', 'data', 'runs', date, 'ingestion', 'all-raw.json')
    let assets = []
    try {
      assets = JSON.parse(readFileSync(rawPath, 'utf-8'))
    } catch {}

    ctx._assets = assets

    if (totalItems < 1) {
      return ExecutionResult.fatal('no_raw_items')
    }

    return ExecutionResult.ok(
      { assets_count: assets.length },
      { raw_count: totalItems, sources_ok: sourcesOk }
    )
  }
}
