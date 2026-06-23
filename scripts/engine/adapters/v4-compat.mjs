/**
 * v4 兼容适配器 — 写兼容（按需使用）
 * 将 v4 Event 格式转换回 v3 curated.json 格式
 * 仅供必须读 v3 格式的旧工具使用，正常流程不调用
 */

/**
 * Event[] → v3 curated.json 格式
 */
export function adaptEventsToV3Curated(events, date, pipelineVersion = 'v4') {
  return {
    date,
    pipeline_version: pipelineVersion,
    selected_items: events
      .filter(e => e.curation) // 只输出有 curation 快照的 Event
      .map(e => ({
        id: e.id,
        title: e.title,
        url: e.url,
        source_name: e.sources?.[0]?.name || 'unknown',
        source_tier: e.sources?.[0]?.tier || 3,
        published_at: e.sources?.[0]?.publishedAt || null,
        summary_zh: e.summary,
        category: e.metadata?.category || null,

        // 评分字段
        base_score: e.rank?.baseScore ?? null,
        bonus_score: e.rank?.bonusScore ?? null,
        total_score: e.rank?.totalScore ?? null,
        tier_label: e.rank?.tierLabel || null,

        // 选题字段
        importance: e.curation?.importance || null,
        curation_note: e.curation?.note || null,
      })),
    curation_summary: {
      total_selected: events.filter(e => e.curation).length,
    },
  }
}
