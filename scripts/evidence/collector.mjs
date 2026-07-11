/**
 * evidence/collector.mjs — Playwright 驱动的证据采集器
 *
 * 状态机: load → cleanup → locate → score → screenshot → save
 * 确定性逻辑，不依赖 LLM。
 */

import { chromium } from 'playwright'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { createEvidence, writeEvidence } from './model.mjs'
import { extractKeywords } from './keywords.mjs'
import { scoreEvidence } from './scorer.mjs'

const LOAD_TIMEOUT = 30_000

/**
 * DOM 清理脚本：移除广告、弹窗、导航等干扰元素
 */
const CLEANUP_SCRIPT = () => {
  // 广告
  const adSelectors = [
    '.ad', '.ads', '.advertisement', '.ad-container', '.ad-wrapper',
    'ins.adsbygoogle', '.sponsored', '.promoted',
  ]
  for (const sel of adSelectors) {
    document.querySelectorAll(sel).forEach(el => el.remove())
  }

  // 弹窗
  const modalSelectors = [
    '.cookie-banner', '.cookie-consent', '.gdpr', '.consent-banner',
    '.newsletter-popup', '.newsletter-signup', '.popup-modal',
    '.login-modal', '.signup-modal', '.overlay',
    '[class*="modal"]', '[class*="popup"]', '[class*="overlay"]',
    '[id*="modal"]', '[id*="popup"]',
  ]
  for (const sel of modalSelectors) {
    document.querySelectorAll(sel).forEach(el => el.remove())
  }

  // 干扰元素
  const noiseSelectors = [
    'nav', '.nav', '.navbar', '.navigation',
    'footer', '.footer', '.site-footer',
    '.sticky', '.sticky-header', '.sticky-footer',
    '.sidebar', '.side-bar',
    '.social-share', '.share-buttons',
    '.related-posts', '.recommended',
    '.comments', '.comment-section',
    'header', '.header', '.site-header',
  ]
  for (const sel of noiseSelectors) {
    document.querySelectorAll(sel).forEach(el => el.remove())
  }

  // 移除固定定位元素
  document.querySelectorAll('*').forEach(el => {
    const style = window.getComputedStyle(el)
    if (style.position === 'fixed' || style.position === 'sticky') {
      el.remove()
    }
  })
}

/**
 * 定位内容区 selector
 * @returns {string|null}
 */
function LOCATE_CONTENT() {
  const selectors = [
    'article',
    '[role="main"]',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content',
    'main',
    '#content',
    '.body',
  ]
  for (const sel of selectors) {
    const el = document.querySelector(sel)
    if (el && el.getBoundingClientRect().height > 200) return sel
  }
  return null
}

/**
 * 关键词评分段落
 * @param {string[]} keywords
 * @returns {{ text: string, score: number, index: number, selector: string }|null}
 */
function SCORE_PARAGRAPHS(keywords) {
  const ps = document.querySelectorAll('p')
  let best = null

  for (let i = 0; i < ps.length; i++) {
    const text = ps[i].textContent || ''
    if (text.length < 20) continue

    let score = 0
    const lower = text.toLowerCase()
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        score += kw.length > 4 ? 2 : 1
      }
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { text: text.slice(0, 200), score, index: i, selector: `p:nth-child(${i + 1})` }
    }
  }
  return best
}

/**
 * 检测付费墙
 */
function DETECT_PAYWALL() {
  const paywallIndicators = [
    '.paywall', '.paid-content', '.subscription-required',
    '[class*="paywall"]', '[id*="paywall"]',
  ]
  for (const sel of paywallIndicators) {
    if (document.querySelector(sel)) return true
  }
  return false
}

/**
 * 采集单个事件 URL 的证据
 * @param {object} event — { id, title, summary, url, source, entities, ... }
 * @param {object} [opts]
 * @param {string} [opts.outputBase] — output/production/ai/<date>
 * @param {function} [opts.onProgress] — (msg) => void
 * @returns {Promise<object|null>} evidence 对象，失败返回 null
 */
export async function collectEventEvidence(event, opts = {}) {
  const { outputBase = 'output/production/ai', onProgress } = opts
  const log = onProgress || (() => {})

  if (!event?.url) {
    log(`  ⏭ ${event?.id}: 无 URL，跳过`)
    return null
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 },
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  try {
    log(`  📡 ${event.id}: 加载 ${event.url.slice(0, 60)}...`)
    await page.goto(event.url, {
      waitUntil: 'networkidle',
      timeout: LOAD_TIMEOUT,
    })

    // 检测付费墙
    const hasPaywall = await page.evaluate(DETECT_PAYWALL)
    if (hasPaywall) {
      log(`  🔒 ${event.id}: 付费墙，跳过截图`)
      await browser.close()
      return null
    }

    // DOM 清理
    log(`  🧹 ${event.id}: DOM 清理...`)
    await page.evaluate(CLEANUP_SCRIPT)

    // 定位内容区
    const contentSelector = await page.evaluate(LOCATE_CONTENT)
    log(`  📍 ${event.id}: 内容区 selector=${contentSelector || 'body'}`)

    // 关键词评分段落
    const keywords = extractKeywords(event)
    log(`  🔑 ${event.id}: 关键词=${keywords.slice(0, 5).join(', ')}`)

    let bestParagraph = null
    if (keywords.length > 0) {
      bestParagraph = await page.evaluate(SCORE_PARAGRAPHS, keywords)
    }

    // 截图
    let screenshotBuffer = null
    let screenshotSelector = null
    let strategy = 'fallback_full_content'

    if (bestParagraph && bestParagraph.score >= 2) {
      // 有高匹配段落 → element screenshot
      log(`  🎯 ${event.id}: 最佳段落 #${bestParagraph.index} score=${bestParagraph.score}`)
      const el = await page.locator(bestParagraph.selector)
      screenshotBuffer = await el.screenshot({ type: 'png' })
      screenshotSelector = bestParagraph.selector
      strategy = 'keyword_paragraph'
    } else if (contentSelector) {
      // 无匹配 → 内容区全截图
      log(`  📸 ${event.id}: 段落评分不足，截内容区`)
      const el = await page.locator(contentSelector)
      screenshotBuffer = await el.screenshot({ type: 'png' })
      screenshotSelector = contentSelector
      strategy = 'content_area'
    } else {
      // 降级 → body 截图
      log(`  📸 ${event.id}: 无内容区，截 body`)
      screenshotBuffer = await page.screenshot({ fullPage: true, type: 'png' })
      strategy = 'full_page'
    }

    // 获取图片尺寸
    let width = 0, height = 0
    if (screenshotBuffer) {
      // PNG 尺寸无法从 buffer 直接获取，从页面获取
      const box = screenshotSelector
        ? await page.locator(screenshotSelector).boundingBox()
        : await page.evaluate(() => {
            const el = document.querySelector('body')
            const r = el.getBoundingClientRect()
            return { width: r.width, height: r.height }
          })
      if (box) { width = Math.round(box.width); height = Math.round(box.height) }
    }

    // 构建 evidence 对象
    const evidenceDate = event.collectedAt?.slice(0, 10) || new Date().toISOString().slice(0, 10)
    const eventDir = join(outputBase, evidenceDate, 'evidence', event.id)
    const filename = 'screenshot.png'

    // 初始评分（仅 keywordMatch 在采集阶段可算）
    const kwMatch = keywords.length > 0 && bestParagraph
      ? Math.min(bestParagraph.score / (keywords.length * 2), 1.0)
      : 0

    const evidence = createEvidence({
      eventId: event.id,
      source: {
        url: event.url,
        type: 'news',
        publisher: event.source?.name || '',
        collectedAt: new Date().toISOString(),
      },
      method: {
        extractor: 'playwright',
        strategy,
        selector: screenshotSelector || '',
        keywords,
      },
      claim: {
        text: bestParagraph?.text || event.title || '',
        segment: bestParagraph?.text || '',
        offsetStart: bestParagraph ? (bestParagraph.index * 40) : 0,
        offsetEnd: bestParagraph ? ((bestParagraph.index + 1) * 40) : 0,
      },
      asset: {
        type: 'screenshot',
        path: `evidence/${event.id}/${filename}`,
        mime: 'image/png',
        width,
        height,
      },
      scoring: {
        keywordMatch: kwMatch,
        sourceAuthority: 0,
        provenanceCrosscheck: 0,
        overall: 0,
      },
    })

    // 使用评分器完整评分（需外部传入 trustScore / duplicateCount）
    const fullScoring = scoreEvidence(evidence, {
      trustScore: event.source?.tier || 3,
      duplicateCount: 0, // 后续由 BuildEvidenceAssets 通过 ProvenanceService 补全
    })
    evidence.scoring = fullScoring

    // 保存
    const evidenceDir = join(outputBase, evidenceDate, 'evidence', event.id)
    mkdirSync(evidenceDir, { recursive: true })
    writeEvidence(evidence, screenshotBuffer, evidenceDir)

    log(`  ✅ ${event.id}: 证据已保存 (score=${(evidence.scoring.keyword_match * 100).toFixed(0)}%)`)

    await browser.close()
    return evidence
  } catch (err) {
    log(`  ❌ ${event.id}: ${err.message}`)
    await browser.close()
    return null
  }
}

/**
 * 批量采集多个事件的证据
 * @param {object[]} events — 事件列表
 * @param {object} [opts]
 * @returns {Promise<object[]>} evidence 列表（采集成功的）
 */
export async function collectBatchEvidence(events, opts = {}) {
  const results = []
  for (const event of events) {
    try {
      const evidence = await collectEventEvidence(event, opts)
      if (evidence) results.push(evidence)
    } catch (err) {
      // 单个失败不阻塞（容错）
    }
  }
  return results
}
