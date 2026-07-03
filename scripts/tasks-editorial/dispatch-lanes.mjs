/**
 * DispatchLanes Task — 将 Events 分发到各 Lane
 *
 * 调用 LaneDispatcher，产出 ctx._laneMap + ctx._laneConfigs。
 */

import { ExecutionResult } from '../runtime/result.mjs'
import { LaneDispatcher } from '../domain/editorial/lane-dispatcher.mjs'
import { DEFAULT_LANE_CONFIGS } from '../domain/editorial/lane-types.mjs'

export class DispatchLanes {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const events = ctx._events || []
    const dispatcher = new LaneDispatcher()
    const laneMap = dispatcher.dispatch(events, DEFAULT_LANE_CONFIGS)

    ctx._laneMap = laneMap
    ctx._laneConfigs = DEFAULT_LANE_CONFIGS

    // 统计
    const stats = {}
    for (const [laneId, laneEvents] of laneMap) {
      stats[laneId] = laneEvents.length
    }

    return ExecutionResult.ok(
      { lanes: laneMap.size, total: events.length },
      { distribution: stats }
    )
  }
}
