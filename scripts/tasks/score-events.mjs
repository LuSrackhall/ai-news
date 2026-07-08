/**
 * ScoreEvents Task — 评分与分级
 * readModel.load → policyEngine.execute('ranking') → buildEvents → repository.store
 */

import { ExecutionResult } from '../runtime/result.mjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export class ScoreEvents {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    // 读取 raw 数据（从 collect 阶段的输出）
    const rawPath = join('.', 'output', ctx.resources.date, 'raw')
    let rawItems
    try {
      rawItems = JSON.parse(readFileSync(join(rawPath, 'valid-raw.json'), 'utf-8'))
    } catch {
      rawItems = JSON.parse(readFileSync(join(rawPath, 'all-raw.json'), 'utf-8'))
    }

    // 调 Policy 做纯计算
    const ranked = ctx.scope.policyEngine.execute('ranking', rawItems)
    const events = ctx.scope.policyEngine.get('ranking').buildEvents(ranked)

    // 写入 repository
    ctx.scope.events.repository.store(events)

    const auto = ranked.filter(r => r.rank.tierLabel === 'auto')
    const review = ranked.filter(r => r.rank.tierLabel === 'review')

    return ExecutionResult.ok(
      { events_count: events.length },
      { input: rawItems.length, auto: auto.length, review: review.length, skip: ranked.length - auto.length - review.length }
    )
  }
}
