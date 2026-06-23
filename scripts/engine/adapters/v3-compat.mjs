/**
 * v3 兼容适配器 — 读兼容
 * 将 v3 产物转换为 v4 Event / Artifact 格式
 *
 * 只做读兼容，不做写兼容。
 * Store 内部通过此 adapter 读取 v3 历史产物。
 */

/**
 * v3 curated.json → Event[]
 * v3 格式：{ date, pipeline_version, selected_items: [...], curation_summary: {...} }
 */
export function adaptV3CuratedToEvents(v3Curated) {
  if (!v3Curated || !Array.isArray(v3Curated.selected_items)) return []

  return v3Curated.selected_items.map(item => ({
    id: item.id || `v3-${item.title?.slice(0, 20)}`,
    type: 'news',
    title: item.title || '',
    summary: item.summary_zh || item.summary || '',
    url: item.url || null,

    sources: [{
      name: item.source_name || 'unknown',
      tier: item.source_tier || 3,
      url: item.url || null,
      publishedAt: item.published_at || null,
    }],
    assetIds: [item.id || ''],
    clusterId: null,

    contentHash: item.content_hash || null,

    rank: {
      baseScore: item.base_score ?? null,
      bonusScore: item.bonus_score ?? null,
      totalScore: item.total_score ?? null,
      tierLabel: item.tier_label || null,
      factors: item.factors || null,
    },

    curation: item.importance ? {
      importance: item.importance,
      note: item.curation_note || null,
    } : null,

    entities: item.entities || [],
    topics: item.topics || [],
    relatedEventIds: [],

    timeline: {
      collected: item.fetched_at || null,
      verified: null,
      curated: null,
      generated: null,
    },

    metadata: {
      category: item.category || null,
      v3Source: true,
    },
  }))
}

/**
 * v3 article.json → ArticleArtifact.content
 * v3 格式：{ hook, summary_items, deep_items, important_items, brief_items, editorial }
 */
export function adaptV3ArticleToArtifact(v3Article) {
  if (!v3Article) return null

  return {
    type: 'article',
    content: {
      hook: v3Article.hook || '',
      summaryItems: (v3Article.summary_items || []).map(mapSummaryItem),
      deepItems: (v3Article.deep_items || []).map(mapDeepItem),
      importantItems: (v3Article.important_items || []).map(mapImportantItem),
      briefItems: (v3Article.brief_items || []).map(mapBriefItem),
      editorial: mapEditorial(v3Article.editorial),
    },
    rendered: null,
    meta: {
      generatedAt: null,
      model: 'unknown',
      promptVersion: 'v1',
      eventIds: [],
      inputHash: null,
      retryCount: 0,
      v3Source: true,
    },
  }
}

/**
 * v3 script.json → ScriptArtifact.content
 */
export function adaptV3ScriptToArtifact(v3Script) {
  if (!v3Script) return null

  return {
    type: 'script',
    content: {
      hook: mapTimedSection(v3Script.hook),
      overview: mapTimedSection(v3Script.overview),
      closing: mapTimedSection(v3Script.closing),
      deepItems: (v3Script.deep_items || []).map(mapScriptDeepItem),
      quickItems: (v3Script.quick_items || []).map(mapScriptQuickItem),
    },
    rendered: null,
    meta: {
      generatedAt: null,
      model: 'unknown',
      promptVersion: 'v1',
      eventIds: [],
      inputHash: null,
      totalDurationS: computeScriptDuration(v3Script),
      v3Source: true,
    },
  }
}

// ── 内部映射函数 ──

function mapSummaryItem(item) {
  return {
    title: item.title || '',
    oneLiner: item.one_liner || item.oneLiner || '',
  }
}

function mapDeepItem(item) {
  return {
    title: item.title || '',
    whatHappened: item.what_happened || item.whatHappened || '',
    details: item.details || '',
    whyMatters: item.why_matters || item.whyMatters || '',
    implications: item.implications || '',
    sources: item.sources || [],
  }
}

function mapImportantItem(item) {
  return {
    title: item.title || '',
    keyPoint: item.key_point || item.keyPoint || '',
    analysis: item.analysis || '',
    source: item.source || '',
  }
}

function mapBriefItem(item) {
  return { title: item.title || '', fact: item.fact || '' }
}

function mapEditorial(ed) {
  if (!ed) return { observation: '', evidence: '', judgment: '', prediction: '' }
  return {
    observation: ed.observation || '',
    evidence: ed.evidence || '',
    judgment: ed.judgment || '',
    prediction: ed.prediction || '',
  }
}

function mapTimedSection(section) {
  if (!section) return { text: '', durationS: 0 }
  return {
    text: section.text || '',
    durationS: section.duration_s || section.durationS || 0,
  }
}

function mapScriptDeepItem(item) {
  return {
    title: item.title || '',
    text: item.text || '',
    durationS: item.duration_s || item.durationS || 0,
  }
}

function mapScriptQuickItem(item) {
  return {
    title: item.title || '',
    text: item.text || '',
    durationS: item.duration_s || item.durationS || 0,
  }
}

function computeScriptDuration(script) {
  let total = 0
  if (script?.hook?.duration_s) total += script.hook.duration_s
  if (script?.overview?.duration_s) total += script.overview.duration_s
  if (script?.closing?.duration_s) total += script.closing.duration_s
  for (const item of (script?.deep_items || [])) total += (item.duration_s || 0)
  for (const item of (script?.quick_items || [])) total += (item.duration_s || 0)
  return total
}
