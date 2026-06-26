/**
 * LoadWeekEvents Task — 读取最近 7 天 Event
 */

import { ExecutionResult } from '../runtime/result.mjs'

export class LoadWeekEvents {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const readModel = ctx.scope.events.readModel
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const from = weekAgo.toISOString().slice(0, 10) + 'T00:00:00'
    const to = now.toISOString().slice(0, 10) + 'T23:59:59'

    const events = readModel.findByWindow(from, to)

    ctx._weekEvents = events
    ctx._weekRange = { from, to }

    return ExecutionResult.ok(
      { count: events.length },
      { from, to, events: events.length }
    )
  }
}
