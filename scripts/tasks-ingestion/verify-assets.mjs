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

    execSync(`node scripts/verify-urls.mjs --date ${date}`, {
      encoding: 'utf-8',
      timeout: 60_000,
      cwd: ctx.resources.workspace || '.',
    })

    const validPath = join(ctx.resources.workspace || '.', 'output', date, 'raw', 'valid-raw.json')
    let validCount = 0
    try {
      const valid = JSON.parse(readFileSync(validPath, 'utf-8'))
      validCount = Array.isArray(valid) ? valid.length : 0
    } catch {}

    return ExecutionResult.ok(
      { valid: validCount },
      { valid: validCount }
    )
  }
}
