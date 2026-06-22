/**
 * AI 日报 - 跨日去重模块 (Phase 3b)
 * 三级去重：URL 精确 → 事件指纹 → 标题 bigram 相似度
 *
 * 去重策略：keep_highest_score
 * 历史窗口：14 天
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { WORKFLOW_CONFIG, EVENT_TYPE_WEIGHTS, ENTITY_WEIGHTS } from './config.mjs'

/**
 * 提取英文单词和中文 bigram
 */
function extractKeywords(title) {
  const t = title.replace(/[\s\-_|·：:，,。.！!？?""''「」【】《》()（）]/g, '')
  const enWords = (t.match(/[a-zA-Z][a-zA-Z0-9.]+/g) || []).map((w) => w.toLowerCase())
  const zhChars = t.replace(/[^一-鿿]/g, '')
  const zhBigrams = []
  for (let i = 0; i < zhChars.length - 1; i++) {
    zhBigrams.push(zhChars.slice(i, i + 2))
  }
  return new Set([...enWords, ...zhBigrams])
}

/**
 * 计算标题相似度（关键词交集比率）
 */
export function computeTitleSimilarity(titleA, titleB) {
  const kwA = extractKeywords(titleA)
  const kwB = extractKeywords(titleB)
  if (kwA.size === 0 || kwB.size === 0) return 0
  const intersection = new Set([...kwA].filter((x) => kwB.has(x)))
  return intersection.size / Math.min(kwA.size, kwB.size)
}

/**
 * 提取事件指纹
 * 格式: Entity|EventType|TopKeywords|YYYY-WXX
 */
export function extractEventFingerprint(title, publishedAt) {
  const lower = title.toLowerCase()

  // 提取实体
  const entities = []
  for (const tier of Object.values(ENTITY_WEIGHTS)) {
    if (!tier.entities) continue
    for (const entity of tier.entities) {
      if (lower.includes(entity.toLowerCase())) {
        entities.push(entity)
      }
    }
  }

  // 提取事件类型
  let eventType = 'general'
  let maxScore = 0
  for (const [type, config] of Object.entries(EVENT_TYPE_WEIGHTS)) {
    if (type === 'general') continue
    let matched = false
    if (config.keywords) {
      matched = config.keywords.some((kw) => lower.includes(kw.toLowerCase()))
    }
    if (!matched && config.regex) {
      matched = config.regex.test(title)
    }
    if (matched && config.score > maxScore) {
      eventType = type
      maxScore = config.score
    }
  }

  // 提取 Top3 关键词（排除停用词和实体）
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'with', '的', '了', '在', '是', '和', '与'])
  const words = extractKeywords(title)
  const keywords = [...words]
    .filter((w) => !stopWords.has(w) && w.length > 1)
    .slice(0, 3)

  // DateBucket（ISO 周编号）
  let dateBucket = 'unknown'
  if (publishedAt) {
    const d = new Date(publishedAt)
    // ISO week number
    const jan1 = new Date(d.getFullYear(), 0, 1)
    const dayOfYear = Math.floor((d - jan1) / 86400000) + 1
    const weekNum = Math.ceil(dayOfYear / 7)
    dateBucket = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
  }

  const entityStr = entities.length > 0 ? entities.sort().join('+') : 'unknown'
  return `${entityStr}|${eventType}|${keywords.join(',')}|${dateBucket}`
}

/**
 * 检查单条新闻是否与历史数据重复
 */
function isDuplicate(newItem, historicalItems, titleThreshold = 0.5) {
  for (const existing of historicalItems) {
    // Level 1: URL 精确匹配
    if (newItem.url && existing.url && newItem.url === existing.url) {
      return { isDup: true, reason: 'url_exact_match', level: 1, matched: existing }
    }

    // Level 2: 事件指纹匹配
    const newFp = extractEventFingerprint(newItem.title, newItem.publishedAt)
    const existingFp = extractEventFingerprint(existing.title, existing.publishedAt || existing.published_at)
    if (newFp === existingFp) {
      return { isDup: true, reason: `event_fingerprint: ${newFp}`, level: 2, matched: existing }
    }

    // Level 3: 标题 bigram 相似度
    const sim = computeTitleSimilarity(newItem.title, existing.title || '')
    if (sim >= titleThreshold) {
      return { isDup: true, reason: `title_similarity: ${sim.toFixed(2)}`, level: 3, matched: existing }
    }
  }
  return { isDup: false }
}

/**
 * 加载最近 N 天的 curated.json 历史数据
 */
function loadHistory(outputDir, date, lookbackDays) {
  const historicalItems = []
  const d = new Date(date)

  for (let i = 1; i <= lookbackDays; i++) {
    const pastDate = new Date(d)
    pastDate.setDate(pastDate.getDate() - i)
    const dateStr = pastDate.toISOString().slice(0, 10)
    const curatedPath = join(outputDir, dateStr, 'curated.json')

    if (existsSync(curatedPath)) {
      try {
        const data = JSON.parse(readFileSync(curatedPath, 'utf-8'))
        const items = data.selected_items || data.curated_items || data.valid_items || []
        for (const item of items) {
          historicalItems.push(item)
        }
      } catch {
        // 跳过无法解析的文件
      }
    }
  }

  return historicalItems
}

/**
 * 对所有条目执行跨日去重
 * @param {Array} items - 当日候选条目（已评分）
 * @param {string} outputDir - 输出目录
 * @param {string} date - 当日日期
 * @returns {{ kept: Array, removed: Array }}
 */
export function dedup(items, outputDir, date) {
  const lookbackDays = WORKFLOW_CONFIG.dedupDays || 14
  const historicalItems = loadHistory(outputDir, date, lookbackDays)

  const kept = []
  const removed = []

  for (const item of items) {
    const result = isDuplicate(item, historicalItems)
    if (result.isDup) {
      removed.push({
        id: item.id,
        title: item.title,
        score: item.scores?.total,
        reason: result.reason,
        matched_title: result.matched?.title,
      })
    } else {
      kept.push(item)
    }
  }

  return { kept, removed, historicalCount: historicalItems.length }
}
