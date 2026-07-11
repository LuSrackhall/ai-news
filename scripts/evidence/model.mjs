/**
 * evidence/model.mjs — 证据数据模型
 *
 * Evidence 是证据资产的一等公民：包含采集方法（method）、
 * 证明了什么（claim）、存储位置（asset）、评分（scoring）。
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

/**
 * 创建 Evidence 对象
 * @param {object} params
 * @param {string} params.eventId
 * @param {object} params.source - { url, type, publisher, collectedAt }
 * @param {object} params.method - { extractor, strategy, selector, keywords }
 * @param {object} params.claim - { text, segment, offsetStart, offsetEnd }
 * @param {object} params.asset - { type, path, mime, width, height }
 * @param {object} params.scoring - { keywordMatch, sourceAuthority, provenanceCrosscheck, overall }
 * @returns {object} evidence
 */
export function createEvidence({
  eventId, source, method, claim, asset, scoring,
}) {
  const id = 'evt_' + createHash('md5').update(eventId + (source?.url || '')).digest('hex').slice(0, 8)

  return {
    id,
    event_id: eventId,
    source: {
      url: source?.url || '',
      type: source?.type || 'news',
      publisher: source?.publisher || '',
      collected_at: source?.collectedAt || new Date().toISOString(),
    },
    method: {
      extractor: method?.extractor || 'playwright',
      strategy: method?.strategy || 'keyword_paragraph',
      selector: method?.selector || '',
      keywords: method?.keywords || [],
    },
    claim: {
      text: claim?.text || '',
      segment: claim?.segment || '',
      offset_start: claim?.offsetStart ?? 0,
      offset_end: claim?.offsetEnd ?? 0,
    },
    asset: {
      type: asset?.type || 'screenshot',
      path: asset?.path || '',
      mime: asset?.mime || 'image/png',
      width: asset?.width || 0,
      height: asset?.height || 0,
    },
    scoring: {
      keyword_match: scoring?.keywordMatch ?? 0,
      source_authority: scoring?.sourceAuthority ?? 0,
      provenance_crosscheck: scoring?.provenanceCrosscheck ?? 0,
      overall: scoring?.overall ?? 0,
    },
  }
}

/**
 * 将 evidence + 截图写入 output 目录
 * @param {object} evidence — createEvidence 的返回值
 * @param {Buffer} screenshotBuffer — PNG 二进制
 * @param {string} outputDir — output/production/ai/<date>/evidence/<event-id>/
 * @returns {string} evidence.json 的路径
 */
export function writeEvidence(evidence, screenshotBuffer, outputDir) {
  mkdirSync(outputDir, { recursive: true })
  const pngPath = join(outputDir, 'screenshot.png')
  const jsonPath = join(outputDir, 'evidence.json')

  if (screenshotBuffer && screenshotBuffer.length > 0) {
    writeFileSync(pngPath, screenshotBuffer)
  }

  writeFileSync(jsonPath, JSON.stringify(evidence, null, 2))
  return jsonPath
}
