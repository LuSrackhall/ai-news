/**
 * AI 日报 - 反馈数据采集 (每期运行后自动生成)
 * 为进化能力提供数据基础
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { PIPELINE_VERSION } from './config.mjs'

export function generateFeedback(outputDir, date, pipelineData) {
  const { candidates, curated, manifest } = pipelineData

  // 计算 LLM 选题保留率
  const candidateCount = (candidates?.auto_items?.length || 0) + (candidates?.review_items?.length || 0)
  const selectedCount = curated?.selected_items?.length || 0
  const retentionRate = candidateCount > 0 ? selectedCount / candidateCount : 0

  // 计算评分-选题对齐率
  const autoItems = candidates?.auto_items || []
  const selectedIds = new Set((curated?.selected_items || []).map(i => i.id))
  const autoSelected = autoItems.filter(i => selectedIds.has(i.id)).length
  const alignmentRate = autoItems.length > 0 ? autoSelected / autoItems.length : 0

  // 按实体统计入选情况
  const entityPerformance = {}
  const allCandidates = [...(candidates?.auto_items || []), ...(candidates?.review_items || [])]
  for (const item of allCandidates) {
    const text = `${item.title || ''} ${item.description || ''}`
    // 简单实体提取（匹配 config.mjs 中的实体列表）
    const entities = extractEntities(text)
    for (const entity of entities) {
      if (!entityPerformance[entity]) {
        entityPerformance[entity] = { appeared: 0, selected: 0, totalScore: 0 }
      }
      entityPerformance[entity].appeared++
      entityPerformance[entity].totalScore += item.scores?.total || 0
      if (selectedIds.has(item.id)) {
        entityPerformance[entity].selected++
      }
    }
  }

  // 按事件类型统计
  const eventPerformance = {}
  for (const item of allCandidates) {
    const eventType = detectEventType(item.title || '')
    if (!eventPerformance[eventType]) {
      eventPerformance[eventType] = { appeared: 0, selected: 0, totalScore: 0 }
    }
    eventPerformance[eventType].appeared++
    eventPerformance[eventType].totalScore += item.scores?.total || 0
    if (selectedIds.has(item.id)) {
      eventPerformance[eventType].selected++
    }
  }

  const feedback = {
    date,
    pipeline_version: PIPELINE_VERSION,
    prompt_version: manifest?.prompt_version || 'v1',
    generated_at: new Date().toISOString(),
    metrics: {
      candidate_count: candidateCount,
      selected_count: selectedCount,
      llm_curation_retention_rate: Math.round(retentionRate * 100) / 100,
      score_curation_alignment: Math.round(alignmentRate * 100) / 100,
      dedup_overlap_count: manifest?.quality?.dedup_overlap_count || 0,
      hallucinated_url_count: manifest?.quality?.hallucinated_url_count || 0,
      dead_link_count: manifest?.quality?.dead_link_count || 0,
    },
    entity_performance: entityPerformance,
    event_type_performance: eventPerformance,
  }

  // 写入 feedback.json
  const feedbackPath = join(outputDir, date, 'feedback.json')
  writeFileSync(feedbackPath, JSON.stringify(feedback, null, 2))

  // 追加到全局趋势文件
  const trendPath = join(outputDir, 'quality-trend.json')
  let trend = []
  try { trend = JSON.parse(readFileSync(trendPath, 'utf-8')) } catch {}
  // 移除当天旧数据（重跑时）
  trend = trend.filter(t => t.date !== date)
  trend.push({ date, ...feedback.metrics })
  // 保留最近 60 天
  trend = trend.slice(-60)
  writeFileSync(trendPath, JSON.stringify(trend, null, 2))

  return feedback
}

function extractEntities(text) {
  const entities = []
  const known = [
    'OpenAI', 'Google', 'DeepMind', 'Anthropic', 'Meta', 'Apple',
    'Microsoft', 'DeepSeek', 'NVIDIA', 'xAI', 'Mistral',
    'Hugging Face', 'Stability AI', 'Cohere', 'Midjourney', 'Runway', 'Perplexity',
    '百度', '阿里', '字节跳动', '腾讯', '华为', '小米',
  ]
  const lower = text.toLowerCase()
  for (const entity of known) {
    if (lower.includes(entity.toLowerCase())) entities.push(entity)
  }
  return entities
}

function detectEventType(title) {
  const lower = title.toLowerCase()
  if (/发布|release|launch|announce|unveil|新模型|新版本/.test(lower)) return 'model_release'
  if (/融资|funding|raised|valuation|估值/.test(lower)) return 'funding'
  if (/政策|regulation|ban|监管|立法/.test(lower)) return 'policy'
  if (/开源|open.source|GitHub/.test(lower)) return 'open_source'
  if (/加入|离开|joins|leaves|hires/.test(lower)) return 'talent_movement'
  if (/收购|acquire|acquisition/.test(lower)) return 'acquisition'
  if (/breakthrough|SOTA|突破|首次/.test(lower)) return 'breakthrough'
  return 'general'
}
