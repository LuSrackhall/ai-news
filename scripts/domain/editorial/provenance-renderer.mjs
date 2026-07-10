/**
 * provenance-renderer.mjs — 分层来源链渲染
 *
 * 将扁平来源列表升级为分层来源链：
 *   来源：[36氪](url) | [Reuters](url)
 *   变为：
 *   > 来源链：
 *   > Reuters（一手来源）
 *   > 36氪（转引自 Reuters）
 *
 * 输出格式：markdown 兼容，可用于 article.md 和 script.md。
 *
 * 用法：
 *   const renderer = new ProvenanceRenderer(db)
 *   const md = renderer.renderSourceChain(sources)
 */

import { createProvenanceService } from '../services/provenance-service.mjs'

export class ProvenanceRenderer {
  constructor(db) {
    this._service = db ? createProvenanceService(db) : null
  }

  /**
   * 将来源列表渲染为分层来源链
   * @param {Array} sources — [{ name, url }] 格式的来源列表
   * @returns {string} markdown 格式的来源链
   */
  renderSourceChain(sources = []) {
    if (!sources || sources.length === 0) return ''

    const lines = []
    const processed = new Set()

    for (const src of sources) {
      if (!src.name || processed.has(src.name)) continue
      processed.add(src.name)

      const pub = this._service ? this._lookupPublisher(src.name) : null

      if (pub && pub.publisherType === 'official') {
        lines.push(`- ${pub.canonical}（一手来源）`)
      } else if (pub && pub.chain && pub.chain.length > 0) {
        lines.push(`- ${pub.chain.join(' → ')}`)
      } else {
        lines.push(`- ${src.name}`)
      }
    }

    if (lines.length === 0) return ''
    return `**来源链：**\n${lines.join('\n')}\n`
  }

  _lookupPublisher(sourceName) {
    if (!this._service) return null
    return this._service.resolvePublisher(sourceName.toLowerCase())
  }
}
