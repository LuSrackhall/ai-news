/**
 * VerifyAssets Task — URL 验证
 */

import { ExecutionResult } from '../runtime/result.mjs'

export class VerifyAssets {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const result = await ctx.host.invoke(
      `运行以下命令验证 URL 可访问性，然后报告结果: node scripts/verify-urls.mjs --date ${ctx.resources.date}
报告：有效条数、移除条数。不要修改数据。`,
      {
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

    return ExecutionResult.ok(
      { valid: result.valid },
      { checked: result.checked, valid: result.valid, removed: result.removed || 0 }
    )
  }
}
