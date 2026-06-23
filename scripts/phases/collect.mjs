/**
 * CollectPhase — RSS 采集
 * 薄用例：直接调 ctx.services.agent 执行外部脚本
 */

import { PhaseResult } from '../engine/phase-result.mjs'

export class CollectPhase {
  name = 'RSS 采集'

  async run(ctx) {
    const result = await ctx.services.agent.call(
      `你是一个脚本执行器。运行以下命令采集 RSS 数据，然后报告结果。

执行命令:
\`\`\`
node scripts/collect-rss.mjs --date ${ctx.environment.date}
\`\`\`

运行完毕后，报告：
1. 成功采集了几个源
2. 总共多少条新闻
3. 失败了几个源

不要修改任何数据，只报告采集结果。`,
      {
        label: 'RSS 采集',
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

    ctx.services.metrics.record(this.name, 'raw_count', result.total_items)

    if (result.total_items < 1) {
      return PhaseResult.fatal('no_raw_items')
    }

    return PhaseResult.ok({
      raw_count: result.total_items,
      sources_ok: result.sources_ok,
      sources_error: result.sources_error,
      failures: result.failures || [],
    })
  }
}
