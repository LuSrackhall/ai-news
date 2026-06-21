#!/usr/bin/env node
/**
 * AI 日报 - RSS 采集脚本
 * 零 LLM 成本，纯代码执行
 *
 * 用法: node scripts/collect-rss.mjs [--date 2026-06-20]
 *
 * 输出: output/<date>/raw/all-raw.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { RSS_SOURCES, AI_KEYWORDS, WORKFLOW_CONFIG } from './config.mjs'

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

/** 从 XML 字符串中提取所有 <item> 或 <entry> 块 */
function extractItems(xml) {
  const items = []
  // RSS 2.0: <item>...</item>
  const rssItemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi
  let match
  while ((match = rssItemRegex.exec(xml)) !== null) {
    items.push(parseItem(match[1]))
  }
  // Atom: <entry>...</entry>
  const atomItemRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi
  while ((match = atomItemRegex.exec(xml)) !== null) {
    items.push(parseItem(match[1]))
  }
  return items
}

/** 从单个 item XML 中提取字段 */
function parseItem(xml) {
  const get = (tag) => {
    // 支持 CDATA: <tag><![CDATA[content]]></tag>
    const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i')
    const cdataMatch = xml.match(cdataRegex)
    if (cdataMatch) return cdataMatch[1].trim()

    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
    const m = xml.match(regex)
    if (m) {
      return m[1]
        .replace(/<!\[CDATA\[|\]\]>/g, '')
        .replace(/<[^>]+>/g, '') // 去除内嵌 HTML 标签
        .trim()
    }

    // Atom: <link href="..." />
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

/** 解析日期为 ISO 8601 */
function parseDate(dateStr) {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? null : d.toISOString()
  } catch {
    return null
  }
}

/** 生成短哈希 ID */
function hashId(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8)
}

// ============================================================
// 关键词过滤（粗筛）
// ============================================================
function isAIRelated(title, description) {
  const text = `${title} ${description}`.toLowerCase()
  return AI_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()))
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
          title: item.title,
          url: item.link,
          description: item.description?.slice(0, 1000) || '',
          publishedAt,
          collectedAt: new Date().toISOString(),
        }
      })
      .filter((item) => {
        // 过滤：必须有标题和链接
        if (!item.title || !item.url) return false
        // 过滤：只保留 24 小时内的（严格窗口，保证日报时效性）
        if (item.publishedAt) {
          const age = Date.now() - new Date(item.publishedAt).getTime()
          if (age > 24 * 60 * 60 * 1000) return false
        }
        // 粗筛：Tier 1/2 不过滤关键词，Tier 3 需要 AI 相关
        if (source.tier >= 3 && !isAIRelated(item.title, item.description)) return false
        return true
      })

    return { source: source.id, status: 'ok', count: items.length, items }
  } catch (err) {
    const error = err.name === 'AbortError' ? 'Timeout' : err.message
    return { source: source.id, status: 'error', error, items: [] }
  } finally {
    clearTimeout(timeout)
  }
}

// ============================================================
// 主流程
// ============================================================
async function main() {
  console.log(`\n📡 AI 日报 RSS 采集 | ${DATE}`)
  console.log(`   源数量: ${RSS_SOURCES.length}`)
  console.log(`   输出: ${OUTPUT_DIR}/all-raw.json\n`)

  mkdirSync(OUTPUT_DIR, { recursive: true })

  // 并行采集所有源（真正的 Promise.all，不是 LLM agent）
  const results = await Promise.allSettled(
    RSS_SOURCES.map((source, i) =>
      // 简单的请求间隔错开，避免同时请求
      new Promise((resolve) => setTimeout(() => resolve(fetchFeed(source)), i * 200))
    )
  )

  // 汇总结果
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

  // URL 去重
  const seen = new Set()
  const deduped = allItems.filter((item) => {
    const key = item.url || item.guid
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // 按发布时间降序排序
  deduped.sort((a, b) => {
    if (!a.publishedAt && !b.publishedAt) return 0
    if (!a.publishedAt) return 1
    if (!b.publishedAt) return -1
    return new Date(b.publishedAt) - new Date(a.publishedAt)
  })

  // 写入文件
  const allRawPath = join(OUTPUT_DIR, 'all-raw.json')
  writeFileSync(allRawPath, JSON.stringify(deduped, null, 2), 'utf-8')

  if (failures.length > 0) {
    const failuresPath = join(OUTPUT_DIR, 'failures.json')
    writeFileSync(failuresPath, JSON.stringify(failures, null, 2), 'utf-8')
  }

  // 汇总
  const summary = {
    date: DATE,
    collectedAt: new Date().toISOString(),
    sources: { total: RSS_SOURCES.length, ok: totalOk, error: totalError },
    items: { raw: allItems.length, deduped: deduped.length },
    failures,
  }

  console.log(`\n📊 汇总:`)
  console.log(`   成功源: ${totalOk}/${RSS_SOURCES.length}`)
  console.log(`   原始条目: ${allItems.length} → 去重后: ${deduped.length}`)
  console.log(`   输出: ${allRawPath}`)
  if (failures.length > 0) {
    console.log(`   失败源: ${failures.map((f) => f.source).join(', ')}`)
  }

  // 输出 JSON 到 stdout 供 Workflow 读取
  console.log(`\n__SUMMARY_JSON__${JSON.stringify(summary)}__END__`)
}

main().catch((err) => {
  console.error('❌ 采集脚本异常:', err)
  process.exit(1)
})
