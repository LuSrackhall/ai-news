/**
 * FilterGitHubNoise Task — GitHub/Atom 源噪音过滤
 * 在归一化之后、评分之前执行
 */

import { ExecutionResult } from '../runtime/result.mjs'
import { GitHubNoiseRule } from '../rules/github-noise-rule.mjs'
import { createSqliteDatabase } from '../infrastructure/database.mjs'

export class FilterGitHubNoise {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const assets = ctx._assets || []
    const rule = new GitHubNoiseRule()

    const { passed, quarantined } = rule.filter(assets)

    // 写入隔离池
    if (quarantined.length > 0) {
      try {
        const db = createSqliteDatabase()
        const now = new Date().toISOString()
        const expiresAt = rule.getExpiresAt()

        const insert = db.prepare(`
          INSERT OR REPLACE INTO quarantine (id, event_id, source_id, title, url, reason, quarantined_at, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)

        const cleanup = db.prepare(`DELETE FROM quarantine WHERE expires_at < ?`)

        // 自动清理过期事件
        cleanup.run(now)

        // 写入新拦截事件
        for (const { event, reason } of quarantined) {
          insert.run(
            `q-${event.id}-${Date.now()}`,
            event.id,
            event.sourceId || '',
            event.title || '',
            event.url || '',
            reason,
            now,
            expiresAt,
          )
        }

        db.close()
      } catch (err) {
        // 隔离池写入失败不阻塞主流程
        ctx.host?.log?.(`⚠️ 隔离池写入失败: ${err.message}`)
      }
    }

    ctx._assets = passed

    return ExecutionResult.ok(
      { filtered: passed.length, quarantined: quarantined.length },
      { input: assets.length, output: passed.length, dropped: quarantined.length }
    )
  }
}
