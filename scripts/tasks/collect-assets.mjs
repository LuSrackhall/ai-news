/**
 * CollectAssets Task — RSS 采集
 * 调 host.invoke 执行外部脚本，写入 assets repository
 */

import { ExecutionResult } from '../runtime/result.mjs'

export class CollectAssets {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const result = await ctx.host.invoke(
      `你是一个脚本执行器。运行以下命令采集 RSS 数据，然后报告结果。
执行命令: node scripts/collect-rss.mjs --date ${ctx.resources.date}
报告：成功采集了几个源、总共多少条新闻、失败了几个源。不要修改任何数据。`,
      {
        model: 'haiku',
        schema: {
          type: 'object',
          properties: {
            sources_ok: { type: 'number' },
            sources_error: { type: 'number' },
            total_items: { type: 'number' },
            output_path: { type: 'string' },
            failures: { type: 'array', items: { type: 'string' } },
          },
          required: ['sources_ok', 'total_items', 'output_path'],
        },
      }
    )

    if (result.total_items < 1) return ExecutionResult.fatal('no_raw_items')

    return ExecutionResult.ok(
      { total_items: result.total_items },
      { raw_count: result.total_items, sources_ok: result.sources_ok, failures: result.failures || [] }
    )
  }
}
