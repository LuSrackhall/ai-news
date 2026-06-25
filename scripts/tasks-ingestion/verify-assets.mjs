/**
 * VerifyAssets Task — URL 可访问性检查
 * 直接调用 verify-urls.mjs 脚本，不依赖 Host.invoke
 */

import { ExecutionResult } from '../runtime/result.mjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

export class VerifyAssets {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const date = ctx.resources.date

    try {
      execSync(`node scripts/verify-urls.mjs --date ${date}`, {
        encoding: 'utf-8',
        timeout: 1_200_000,  // 20 分钟
        cwd: ctx.resources.workspace || '.',
      })
    } catch (err) {
      // 验证超时不阻塞管道，继续用未验证的数据
      ctx.host?.log?.(`⚠️ URL 验证超时或失败: ${err.message}，继续使用未验证数据`)
    }

    const validPath = join(ctx.resources.workspace || '.', 'output', date, 'raw', 'valid-raw.json')
    const allRawPath = join(ctx.resources.workspace || '.', 'output', date, 'raw', 'all-raw.json')
    let validCount = 0
    try {
      const valid = JSON.parse(readFileSync(validPath, 'utf-8'))
      validCount = Array.isArray(valid) ? valid.length : 0
    } catch {
      // 没有 valid-raw.json，用 all-raw.json
      try {
        const all = JSON.parse(readFileSync(allRawPath, 'utf-8'))
        validCount = Array.isArray(all) ? all.length : 0
      } catch {}
    }

    return ExecutionResult.ok(
      { valid: validCount },
      { valid: validCount }
    )
  }
}
