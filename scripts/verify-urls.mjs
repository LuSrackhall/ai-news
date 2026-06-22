#!/usr/bin/env node
/**
 * AI 日报 - URL 验证模块 (Phase 2)
 * 对每条采集结果的 URL 发 HEAD 请求，移除死链
 *
 * 用法: node scripts/verify-urls.mjs --date 2026-06-22
 *
 * 输入: output/<date>/raw/all-raw.json
 * 输出: output/<date>/raw/valid-raw.json, failures.json
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { WORKFLOW_CONFIG, PIPELINE_VERSION } from './config.mjs'

const { values: args } = parseArgs({
  options: {
    date: { type: 'string', default: new Date().toISOString().slice(0, 10) },
  },
})
const DATE = args.date
const RAW_DIR = join(WORKFLOW_CONFIG.outputDir, DATE, 'raw')

/**
 * 验证单个 URL 是否可访问
 * @returns {{ url: string, status: number|null, ok: boolean, error?: string }}
 */
async function verifyUrl(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), WORKFLOW_CONFIG.urlVerifyTimeout)

  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'AiRibao/1.0 (url-check)' },
    })
    return { url, status: res.status, ok: res.status >= 200 && res.status < 400 }
  } catch (err) {
    return { url, status: null, ok: false, error: err.name === 'AbortError' ? 'Timeout' : err.message }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * 并发验证 URL 列表
 */
async function verifyUrls(items) {
  const concurrency = WORKFLOW_CONFIG.urlVerifyConcurrency || 5
  const results = new Map()

  // 按 URL 去重（同一条 URL 只验证一次）
  const uniqueUrls = [...new Set(items.map((item) => item.url).filter(Boolean))]

  for (let i = 0; i < uniqueUrls.length; i += concurrency) {
    const batch = uniqueUrls.slice(i, i + concurrency)
    const batchResults = await Promise.allSettled(batch.map(verifyUrl))
    for (const result of batchResults) {
      const data = result.status === 'fulfilled' ? result.value : { url: 'unknown', status: null, ok: false, error: result.reason?.message }
      results.set(data.url, data)
    }
  }

  return results
}

async function main() {
  const inputPath = join(RAW_DIR, 'all-raw.json')

  let items
  try {
    items = JSON.parse(readFileSync(inputPath, 'utf-8'))
  } catch (err) {
    console.error(`❌ 无法读取 ${inputPath}: ${err.message}`)
    process.exit(1)
  }

  console.log(`\n🔗 URL 验证 | ${DATE}`)
  console.log(`   待验证: ${items.length} 条\n`)

  const urlResults = await verifyUrls(items)

  const validItems = []
  const removedItems = []

  for (const item of items) {
    const result = urlResults.get(item.url)
    if (result && result.ok) {
      validItems.push(item)
    } else {
      removedItems.push({
        id: item.id,
        title: item.title,
        url: item.url,
        source: item.sourceName,
        http_code: result?.status,
        reason: result?.error || `HTTP ${result?.status}`,
      })
    }
  }

  // 写入有效条目
  const validPath = join(RAW_DIR, 'valid-raw.json')
  writeFileSync(validPath, JSON.stringify(validItems, null, 2), 'utf-8')

  // 写入移除记录
  const removedPath = join(RAW_DIR, 'url-removed.json')
  writeFileSync(removedPath, JSON.stringify(removedItems, null, 2), 'utf-8')

  console.log(`   ✅ 有效: ${validItems.length}`)
  console.log(`   ❌ 移除: ${removedItems.length}`)
  for (const r of removedItems) {
    console.log(`      - ${r.source}: ${r.title?.slice(0, 40)} (${r.reason})`)
  }

  const summary = {
    date: DATE,
    pipeline_version: PIPELINE_VERSION,
    checked: items.length,
    valid: validItems.length,
    removed: removedItems.length,
    removed_items: removedItems,
  }
  console.log(`\n__SUMMARY_JSON__${JSON.stringify(summary)}__END__`)
}

main().catch((err) => {
  console.error('❌ URL 验证异常:', err)
  process.exit(1)
})
