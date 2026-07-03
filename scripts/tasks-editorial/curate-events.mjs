/**
 * CurateEvents Task — LLM 选题
 */

import { ExecutionResult } from '../runtime/result.mjs'

export class CurateEvents {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    // 优先消费 Candidate Pool，回退到原始 Event 列表
    const candidates = ctx._candidates || []
    let inputList, inputJson

    if (candidates.length > 0) {
      // 构建包含 contextHints 的输入 JSON
      inputList = candidates.map((c) => ({
        ...c.event,
        _contextHints: c.contextHints || [],
        _finalRank: c.finalRank,
      }))
      inputJson = JSON.stringify(inputList, null, 2)
    } else {
      // 回退：无 Candidate Pool 时直接使用 events
      const events = ctx._events || []
      inputList = events
      inputJson = JSON.stringify(events, null, 2)
    }

    const result = await ctx.scope.inference.run('curation', {
      input_data: inputJson.slice(0, 20000),
    })

    if (!result || !result.selected_items || result.selected_items.length < 1) {
      return ExecutionResult.fatal('no_curated_items')
    }

    // 附加 curation 快照到 Event
    const selectedMap = new Map()
    for (const item of result.selected_items) {
      selectedMap.set(item.id, { importance: item.importance, note: item.curation_note || null })
    }

    // 从原始 event 列表中筛选（inputList 可能含 _contextHints 等临时字段）
    const events = ctx._events || []
    const curatedEvents = events
      .filter(e => selectedMap.has(e.id))
      .map(e => ({ ...e, curation: selectedMap.get(e.id) }))

    ctx._curatedEvents = curatedEvents

    return ExecutionResult.ok(
      { selected: curatedEvents.length },
      { input: inputList.length, selected: curatedEvents.length, sources_used: result.curation_summary?.sources_used || [] }
    )
  }
}
