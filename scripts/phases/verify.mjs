/**
 * VerifyPhase — URL 验证
 * 薄用例：直接调 ctx.services.agent 执行外部脚本
 */

import { PhaseResult } from '../engine/phase-result.mjs'

export class VerifyPhase {
  name = 'URL 验证'

  async run(ctx) {
    const result = await ctx.services.agent.call(
      `运行以下命令验证 URL 可访问性，然后报告结果:

\`\`\`bash
node scripts/verify-urls.mjs --date ${ctx.environment.date}
\`\`\`

报告：有效条数、移除条数。不要修改数据。`,
      {
        label: 'URL 验证',
        model: 'haiku',
        schema: {
          type: 'object',
          properties: {
            checked: { type: 'number' },
            valid: { type: 'number' },
            removed: { type: 'number' },
          },
          required: ['checked', 'valid'],
        },
      }
    )

    ctx.services.metrics.record(this.name, 'valid', result.valid)
    ctx.services.metrics.record(this.name, 'removed', result.removed || 0)

    return PhaseResult.ok({
      checked: result.checked,
      valid: result.valid,
      removed: result.removed || 0,
    })
  }
}
