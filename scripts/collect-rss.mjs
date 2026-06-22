#!/usr/bin/env node
/**
 * AI 日报 - RSS 采集脚本 (Pipeline v3)
 * 零 LLM 成本，纯代码执行
 *
 * 用法: node scripts/collect-rss.mjs [--date 2026-06-22]
 *
 * 输出: output/<date>/raw/all-raw.json
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import {
  RSS_SOURCES, AI_KEYWORDS, WORKFLOW_CONFIG, ENTITY_WEIGHTS,
  EVENT_TYPE_WEIGHTS, ACADEMIC_SIGNALS, PIPELINE_VERSION,
} from './config.mjs'

// ============================================================
// 参数解析
// ============================================================
const { values: args } = parseArgs({
  options: {
    date: { type: 'string', default: new Date().toISOString().slice(0, 10) },
  },
})
const DATE = args.date
const OUTPUT_DIR = join(WORKFLOW_CONFIG.outputDir, DATE, 'raw')

// ============================================================
// RSS 解析（轻量级，不依赖第三方库）
// ============================================================

function extractItems(xml) {
  const items = []
  const rssItemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi
  let match
  while ((match = rssItemRegex.exec(xml)) !== null) {
    items.push(parseItem(match[1]))
  }
  const atomItemRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi
  while ((match = atomItemRegex.exec(xml)) !== null) {
    items.push(parseItem(match[1]))
  }
  return items
}

function parseItem(xml) {
  const get = (tag) => {
    const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i')
    const cdataMatch = xml.match(cdataRegex)
    if (cdataMatch) return cdataMatch[1].trim()

    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
    const m = xml.match(regex)
    if (m) {
      return m[1]
        .replace(/<!\[CDATA\[|\]\]>/g, '')
        .replace(/<[^>]+>/g, '')
        .trim()
    }

    if (tag === 'link') {
      const linkMatch = xml.match(/<link[^>]+href=["']([^"']+)["']/i)
      return linkMatch ? linkMatch[1] : ''
    }
    return ''
  }

  const pubDate = get('pubDate') || get('updated') || get('published') || ''
  return {
    title: get('title'),
    link: get('link') || get('guid'),
    description: get('description') || get('summary') || get('content'),
    pubDate,
    guid: get('guid') || get('link') || '',
  }
}

function parseDate(dateStr) {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? null : d.toISOString()
  } catch {
    return null
  }
}

function hashId(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8)
}

// ============================================================
// 关键词过滤
// ============================================================
function isAIRelated(title, description) {
  const text = `${title} ${description}`.toLowerCase()
  return AI_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()))
}

// ============================================================
// 影响力预评分（Bonus 部分，纯代码）
// ============================================================

function computeEntityWeight(text) {
  const lower = text.toLowerCase()
  let maxScore = 0
  let matchCount = 0

  for (const tier of Object.values(ENTITY_WEIGHTS)) {
    if (!tier.entities) continue
    for (const entity of tier.entities) {
      if (lower.includes(entity.toLowerCase())) {
        maxScore = Math.max(maxScore, tier.score)
        matchCount++
      }
    }
  }

  // 多顶级实体 bonus
  if (matchCount >= 2 && maxScore >= 10) {
    maxScore += ENTITY_WEIGHTS.multi_entity_bonus
  }
  return Math.min(maxScore, 12)
}

function computeEventTypeWeight(text) {
  const lower = text.toLowerCase()
  let maxScore = EVENT_TYPE_WEIGHTS.general.score

  for (const [_, config] of Object.entries(EVENT_TYPE_WEIGHTS)) {
    if (config.score === 2) continue // skip general
    let matched = false
    if (config.keywords) {
      matched = config.keywords.some((kw) => lower.includes(kw.toLowerCase()))
    }
    if (!matched && config.regex) {
      matched = config.regex.test(text)
    }
    if (matched) {
      maxScore = Math.max(maxScore, config.score)
    }
  }
  return Math.min(maxScore, 12)
}

function computeQuantitativeSignal(text) {
  let score = 0
  // 金额
  if (/\$[\d.]+\s*[bBmM]/.test(text) || /[\d.]+\s*亿/.test(text)) score += 2
  // 性能指标
  if (/[\d.]+\s*%/.test(text) || /\d+x\s*faster/i.test(text) || /accuracy|准确率/i.test(text)) score += 1
  // 规模指标
  if (/\d+\s*(billion|million|百万|千万|亿)/i.test(text)) score += 1
  return Math.min(score, 6)
}

function computeAcademicSignal(title) {
  const lower = title.toLowerCase()
  let score = 0
  if (ACADEMIC_SIGNALS.hot_topics.some((kw) => lower.includes(kw.toLowerCase()))) {
    score += ACADEMIC_SIGNALS.hot_topic_score
  }
  if (ACADEMIC_SIGNALS.model_names.some((kw) => lower.includes(kw.toLowerCase()))) {
    score += ACADEMIC_SIGNALS.model_name_score
  }
  if (ACADEMIC_SIGNALS.sota_keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
    score += ACADEMIC_SIGNALS.sota_score
  }
  return Math.min(score, 5)
}

function computeImpactScore(title, description) {
  const text = `${title} ${description}`
  const entity = computeEntityWeight(text)
  const eventType = computeEventTypeWeight(text)
  const quant = computeQuantitativeSignal(text)
  const academic = computeAcademicSignal(title)
  return Math.min(entity + eventType + quant + academic, 35)
}

// ============================================================
// 摘要清洗（去除 HTML，截取合理长度）
// ============================================================
function cleanSummary(description) {
  if (!description) return ''
  return description
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500)
}

// ============================================================
// 并行采集
// ============================================================
async function fetchFeed(source) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), WORKFLOW_CONFIG.fetchTimeout)

  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'AiRibao/1.0 (daily-ai-news)',
        Accept: 'application/rss+xml, application/xml, application/atom+xml, text/xml, */*',
      },
    })

    if (!res.ok) {
      return { source: source.id, status: 'error', error: `HTTP ${res.status}`, items: [] }
    }

    const xml = await res.text()
    const rawItems = extractItems(xml)

    const timeWindowHours = source.timeWindowHours || WORKFLOW_CONFIG.defaultTimeWindowHours

    const items = rawItems
      .map((item) => {
        const publishedAt = parseDate(item.pubDate)
        return {
          id: `${source.id}_${hashId(item.guid || item.link || item.title)}`,
          sourceId: source.id,
          sourceName: source.name,
          tier: source.tier,
          language: source.language,
          category: source.category,
          dateReliability: source.dateReliability || 'normal',
          title: item.title,
          url: item.link,
          description: item.description?.slice(0, 1000) || '',
          summary: cleanSummary(item.description),
          publishedAt,
          collectedAt: new Date().toISOString(),
          pipeline_version: PIPELINE_VERSION,
        }
      })
      .filter((item) => {
        if (!item.title || !item.url) return false
        // 时间窗口（学术源 48h，其他 24h）— 仅用于排除过老条目
        if (item.publishedAt) {
          const age = Date.now() - new Date(item.publishedAt).getTime()
          if (age > timeWindowHours * 60 * 60 * 1000) return false
        }
        // 关键词过滤：Tier 3 必须过滤，requireKeywordFilter 源也必须过滤
        const needsFilter = source.tier >= 3 || source.requireKeywordFilter
        if (needsFilter && !isAIRelated(item.title, item.description)) return false
        // 严格日期过滤：只保留目标日期当天的新闻
        if (item.publishedAt) {
          const pubDate = new Date(item.publishedAt)
          const pubDateStr = pubDate.toISOString().slice(0, 10)
          // 规则 1: UTC 日期 == 目标日期 → 通过
          if (pubDateStr === DATE) return true
          // 规则 2: UTC 日期是前一天且时间 >= 18:00 UTC（北京时间次日 02:00）→ 容差通过
          const pubDateObj = new Date(item.publishedAt)
          const nextDay = new Date(pubDateObj)
          nextDay.setUTCDate(nextDay.getUTCDate() + 1)
          if (nextDay.toISOString().slice(0, 10) === DATE && pubDateObj.getUTCHours() >= 18) return true
          // 规则 3: URL 日期交叉校验 — 如果 URL 包含 /YYYY/MM/DD/ 且不是目标日期，拒绝
          const urlDateMatch = item.url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//)
          if (urlDateMatch) {
            const urlDate = `${urlDateMatch[1]}-${urlDateMatch[2]}-${urlDateMatch[3]}`
            if (urlDate !== DATE) return false
          }
          // 规则 4: 其他情况一律拒绝
          if (pubDateStr !== DATE) return false
        }
        return true
      })
      .map((item) => ({
        ...item,
        impactScore: computeImpactScore(item.title, item.description),
        // 对已知使用 updatedAt 的源，标记需要日期校验
        ...(item.dateReliability === 'low' && item.publishedAt &&
          new Date(item.publishedAt).toISOString().slice(0, 10) === DATE
          ? { _needsDateVerification: true }
          : {}),
      }))

    return { source: source.id, status: 'ok', count: items.length, items }
  } catch (err) {
    const error = err.name === 'AbortError' ? 'Timeout' : err.message
    return { source: source.id, status: 'error', error, items: [] }
  } finally {
    clearTimeout(timeout)
  }
}

// ============================================================
// 页面级日期校验（对低可靠性源，获取 HTML 中的真实 datePublished）
// ============================================================

/**
 * 从 HTML 中提取真实发布日期
 * 优先级：JSON-LD datePublished > meta article:published_time > meta datePublished
 */
function extractRealPublishDate(html) {
  // JSON-LD
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)
  if (jsonLdMatch) {
    for (const block of jsonLdMatch) {
      const jsonStr = block.replace(/<\/?script[^>]*>/gi, '')
      try {
        const data = JSON.parse(jsonStr)
        const date = data.datePublished || data.dateCreated
        if (date) return new Date(date).toISOString()
      } catch {}
    }
  }
  // meta article:published_time
  const metaMatch = html.match(/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i)
  if (metaMatch) return new Date(metaMatch[1]).toISOString()
  // meta datePublished
  const dpMatch = html.match(/<meta[^>]+(?:name|property)=["']datePublished["'][^>]+content=["']([^"']+)["']/i)
  if (dpMatch) return new Date(dpMatch[1]).toISOString()
  // meta date
  const dateMatch = html.match(/<meta[^>]+(?:name|property)=["']date["'][^>]+content=["']([^"']+)["']/i)
  if (dateMatch) return new Date(dateMatch[1]).toISOString()
  return null
}

/**
 * 对标记为 _needsDateVerification 的条目，获取页面真实日期并校验
 * 如果真实日期不在目标日期窗口内，标记为 _dateVerified: false
 */
async function verifyPageDates(items, targetDate) {
  const needVerify = items.filter(i => i._needsDateVerification)
  if (needVerify.length === 0) return items

  console.log(`  🔍 页面日期校验: ${needVerify.length} 条待验证...`)

  for (const item of needVerify) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      const res = await fetch(item.url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'AiRibao/1.0 (date-check)' },
      })
      clearTimeout(timeout)

      if (!res.ok) {
        console.log(`    ⚠️ ${item.title?.slice(0, 40)}: HTTP ${res.status}，保留 RSS 日期`)
        continue
      }

      const html = await res.text()
      const realDate = extractRealPublishDate(html)

      if (realDate) {
        const realDateStr = realDate.slice(0, 10)
        const rssDateStr = new Date(item.publishedAt).toISOString().slice(0, 10)

        if (realDateStr !== rssDateStr) {
          console.log(`    🔄 ${item.title?.slice(0, 40)}: RSS=${rssDateStr} → 实际=${realDateStr}`)
          // 用真实日期替换 RSS 日期
          item.publishedAt = realDate
          item._dateCorrected = true
          item._originalRssDate = rssDateStr

          // 检查真实日期是否在目标日期窗口内
          const targetDateObj = new Date(targetDate + 'T12:00:00Z')
          const realDateObj = new Date(realDate)
          const diffHours = Math.abs(targetDateObj.getTime() - realDateObj.getTime()) / (1000 * 60 * 60)
          if (diffHours > 36) {
            item._dateVerified = false
            item._dateVerifyReason = `真实发布日期 ${realDateStr} 距目标日期 ${targetDate} 超过 36h`
            console.log(`    ❌ ${item.title?.slice(0, 40)}: 日期超出窗口，标记为不可用`)
          } else {
            item._dateVerified = true
          }
        } else {
          item._dateVerified = true
          console.log(`    ✅ ${item.title?.slice(0, 40)}: 日期一致 (${realDateStr})`)
        }
      }
    } catch (err) {
      console.log(`    ⚠️ ${item.title?.slice(0, 40)}: 获取失败 (${err.message})，保留 RSS 日期`)
    }
  }

  return items
}

// ============================================================
// 主流程
// ============================================================
async function main() {
  const activeSources = RSS_SOURCES.filter(s => s.enabled !== false)
  const disabledSources = RSS_SOURCES.filter(s => s.enabled === false)
  const probationSources = activeSources.filter(s => s.status === 'probation')

  console.log(`\n📡 AI 日报 RSS 采集 | ${DATE}`)
  console.log(`   源数量: ${activeSources.length} (禁用: ${disabledSources.length})`)
  if (probationSources.length > 0) {
    console.log(`   观察期: ${probationSources.map(s => s.id).join(', ')}`)
  }
  console.log(`   输出: ${OUTPUT_DIR}/all-raw.json\n`)

  mkdirSync(OUTPUT_DIR, { recursive: true })

  const results = await Promise.allSettled(
    activeSources.map((source, i) =>
      new Promise((resolve) => setTimeout(() => resolve(fetchFeed(source)), i * 200))
    )
  )

  const allItems = []
  const failures = []
  let totalOk = 0
  let totalError = 0

  for (const result of results) {
    const data = result.status === 'fulfilled' ? result.value : { source: 'unknown', status: 'error', error: result.reason?.message, items: [] }

    if (data.status === 'ok') {
      totalOk++
      allItems.push(...data.items)
      console.log(`  ✅ ${data.source}: ${data.count} 条`)
    } else {
      totalError++
      failures.push({ source: data.source, error: data.error })
      console.log(`  ❌ ${data.source}: ${data.error}`)
    }
  }

  // ---- 健康追踪 ----
  const healthPath = join('data', 'source-health.json')
  let health = {}
  try { health = JSON.parse(readFileSync(healthPath, 'utf-8')) } catch {}

  for (const result of results) {
    const data = result.status === 'fulfilled' ? result.value : { source: 'unknown', status: 'error', error: result.reason?.message }
    if (!health[data.source]) {
      health[data.source] = { success30d: 0, fail30d: 0, failStreak: 0, lastSuccess: null, lastFailure: null, lastHttpStatus: null }
    }
    const h = health[data.source]
    if (data.status === 'ok') {
      h.success30d++
      h.failStreak = 0
      h.lastSuccess = new Date().toISOString()
    } else {
      h.fail30d++
      h.failStreak++
      h.lastFailure = new Date().toISOString()
      h.lastHttpStatus = data.error
    }
    h.lastChecked = new Date().toISOString()
  }

  // 连续失败告警
  for (const [sourceId, h] of Object.entries(health)) {
    if (h.failStreak >= 3) {
      console.log(`  ⚠️ [WARN] 源 ${sourceId} 连续失败 ${h.failStreak} 天，建议检查`)
    }
    if (h.failStreak >= 7) {
      console.log(`  🔴 [ALERT] 源 ${sourceId} 连续失败 ${h.failStreak} 天，建议禁用`)
    }
  }

  mkdirSync('data', { recursive: true })
  writeFileSync(healthPath, JSON.stringify(health, null, 2))
  // ---- 健康追踪结束 ----

  // URL 去重
  const seen = new Set()
  const deduped = allItems.filter((item) => {
    const key = item.url || item.guid
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // 页面级日期校验（对低可靠性源，获取 HTML 中的真实 datePublished）
  await verifyPageDates(deduped, DATE)
  // 移除日期校验失败的条目
  const dateVerified = deduped.filter(item => item._dateVerified !== false)
  const dateRemoved = deduped.length - dateVerified.length
  if (dateRemoved > 0) {
    console.log(`  📅 页面日期校验移除: ${dateRemoved} 条`)
  }

  // 按发布时间降序排序
  dateVerified.sort((a, b) => {
    if (!a.publishedAt && !b.publishedAt) return 0
    if (!a.publishedAt) return 1
    if (!b.publishedAt) return -1
    return new Date(b.publishedAt) - new Date(a.publishedAt)
  })

  // 写入文件
  const allRawPath = join(OUTPUT_DIR, 'all-raw.json')
  writeFileSync(allRawPath, JSON.stringify(dateVerified, null, 2), 'utf-8')

  if (failures.length > 0) {
    const failuresPath = join(OUTPUT_DIR, 'failures.json')
    writeFileSync(failuresPath, JSON.stringify(failures, null, 2), 'utf-8')
  }

  const summary = {
    date: DATE,
    pipeline_version: PIPELINE_VERSION,
    collectedAt: new Date().toISOString(),
    sources: { total: activeSources.length, ok: totalOk, error: totalError, disabled: disabledSources.length },
    items: { raw: allItems.length, deduped: dateVerified.length, dateRemoved },
    failures,
    health,
  }

  console.log(`\n📊 汇总:`)
  console.log(`   成功源: ${totalOk}/${activeSources.length} (禁用: ${disabledSources.length})`)
  console.log(`   原始条目: ${allItems.length} → 去重后: ${dateVerified.length}`)
  console.log(`   输出: ${allRawPath}`)
  if (failures.length > 0) {
    console.log(`   失败源: ${failures.map((f) => f.source).join(', ')}`)
  }

  // 健康状态摘要
  const healthIssues = Object.entries(health).filter(([_, h]) => h.failStreak >= 3)
  if (healthIssues.length > 0) {
    console.log(`   ⚠️  需关注源: ${healthIssues.map(([id, h]) => `${id}(${h.failStreak}连败)`).join(', ')}`)
  }

  console.log(`\n__SUMMARY_JSON__${JSON.stringify(summary)}__END__`)
}

main().catch((err) => {
  console.error('❌ 采集脚本异常:', err)
  process.exit(1)
})
