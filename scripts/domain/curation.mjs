/**
 * Curation Domain — LLM 选题编排
 * 从 workflow Phase 4 代码提取
 * 封装 prompt 加载 + agent.generate + 结果校验
 */

export function createCurationDomain(ctx) {
  const CURATION_SCHEMA = {
    type: 'object',
    properties: {
      selected_items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            url: { type: 'string' },
            source_name: { type: 'string' },
            published_at: { type: 'string' },
            summary_zh: { type: 'string' },
            category: { type: 'string' },
            importance: { type: 'string' },
            curation_note: { type: 'string' },
          },
          required: ['id', 'title', 'url', 'importance'],
        },
      },
      curation_summary: {
        type: 'object',
        properties: {
          total_selected: { type: 'number' },
          categories_covered: { type: 'array', items: { type: 'string' } },
          sources_used: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    required: ['selected_items', 'curation_summary'],
  }

  return {
    /**
     * @param {Array} candidates - Event[] 候选事件
     * @returns {{ curatedEvents: Array, summary: Object }}
     */
    async select(candidates) {
      const candidatesJson = JSON.stringify(candidates, null, 2)

      const prompt = ctx.services.prompt.load('prompts/v1/curation.md', {
        input_data: candidatesJson.slice(0, 20000),
      })

      const result = await ctx.services.agent.generate(prompt, CURATION_SCHEMA, {
        label: 'LLM 选题',
        phase: 'LLM 选题',
        model: 'sonnet',
      })

      if (!result || !result.selected_items) {
        return { curatedEvents: [], summary: result?.curation_summary || {} }
      }

      // 将 LLM 选题结果附加到 Event 的 curation 快照
      const selectedMap = new Map()
      for (const item of result.selected_items) {
        selectedMap.set(item.id, {
          importance: item.importance,
          note: item.curation_note || null,
        })
      }

      const curatedEvents = candidates.map(event => {
        const curation = selectedMap.get(event.id)
        if (curation) {
          return {
            ...event,
            curation,
            timeline: { ...event.timeline, curated: ctx.environment.clock.now() },
          }
        }
        return event
      }).filter(event => selectedMap.has(event.id))

      return {
        curatedEvents,
        summary: result.curation_summary || {
          total_selected: curatedEvents.length,
        },
        sourcesUsed: result.curation_summary?.sources_used || [],
      }
    },
  }
}
