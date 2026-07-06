/**
 * CurateEvents Task — LLM 选题
 *
 * Architecture Editorial Intelligence v2 升级：
 * - 优先消费 ctx._prioritizedCandidates（JudgmentEngine 的输出）
 * - 回退到 ctx._candidates（MergeEngine 的原始输出）
 * - 再回退到原始 ctx._events
 */

import { ExecutionResult } from '../runtime/result.mjs'

export class CurateEvents {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    // 优先消费 PrioritizedCandidates，再回退到 Candidate pool，最后回退到原始 Event 列表
    const prioritized = ctx._prioritizedCandidates || []
    const candidates = ctx._candidates || []
    let inputList, inputJson

    if (prioritized.length > 0) {
      inputList = prioritized.map((c) => ({
        ...c.event,
        _contextHints: c.signals || [],
        _finalRank: c.finalRank,
      }))
      inputJson = JSON.stringify(inputList, null, 2)
    } else if (candidates.length > 0) {
      inputList = candidates.map((c) => ({
        ...c.event,
        _contextHints: c.contextHints || [],
        _finalRank: c.finalRank,
      }))
      inputJson = JSON.stringify(inputList, null, 2)
    } else {
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

    // 从原始 event 列表中筛选
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
