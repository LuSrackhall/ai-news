/**
 * VerifyAssets Task — URL 可访问性检查
 */

import { ExecutionResult } from '../runtime/result.mjs'

export class VerifyAssets {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const date = ctx.resources.date
    const result = await ctx.host.invoke(
      `运行命令: node scripts/verify-urls.mjs --date ${date}\n报告：有效条数、移除条数。不要修改数据。`,
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
