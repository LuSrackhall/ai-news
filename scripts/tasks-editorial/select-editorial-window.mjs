/**
 * SelectEditorialWindow Task — 按时间窗口读取 Event
 * 基于 effective_at 查询，不是 collected_at
 */

import { ExecutionResult } from '../runtime/result.mjs'

export class SelectEditorialWindow {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const date = ctx.resources.date
    const readModel = ctx.scope.events.readModel

    // 默认：昨天 08:00 到今天 08:00
    const yesterday = new Date(date + 'T00:00:00Z')
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    const from = yesterday.toISOString().slice(0, 10) + 'T08:00:00Z'
    const to = date + 'T08:00:00Z'

    const events = readModel.findByWindow(from, to)

    // 存入 scope 供后续 Task 使用
    ctx._events = events

    if (events.length < 1) {
      return ExecutionResult.fatal('no_events_in_window')
    }

    return ExecutionResult.ok(
      { events_count: events.length },
      { window_from: from, window_to: to, events: events.length }
    )
  }
}
