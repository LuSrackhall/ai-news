/**
 * ProvenanceVerificationRule — 多源验证信号
 *
 * Judgment.Qualification FILTER phase.
 * 如果 provenance 检测到某事件有 >= 3 个独立来源覆盖，
 * 产出 VERIFICATION signal，跳过 contextual rejection。
 */

import { createFilterSignal } from '../signal.mjs'

export class ProvenanceVerificationRule {
  constructor(provenanceService) {
    this._service = provenanceService
  }

  evaluate(events) {
    const signals = []
    if (!this._service) return { signals }

    for (const event of events) {
      const eventId = event.id
      if (!eventId) continue

      // 查 provenance_aliases 找 publisher
      const sourceId = event.sourceId || ''
      const pub = sourceId ? this._service.resolvePublisher(sourceId) : null
      if (!pub) continue

      // 如果是官方或学术源，算 1 个证据
      let evidenceCount = 0
      if (pub.publisherType === 'official') evidenceCount = 2
      else if (pub.publisherType === 'academic') evidenceCount = 2
      else if (pub.publisherType === 'media') evidenceCount = 1

      // 检查 provenance_edges: 是否有 duplicate_of 边（表示多渠道覆盖）
      try {
        const edges = this._service.getDuplicateEdges(eventId)
        evidenceCount += edges.length
      } catch { /* ignore */ }

      if (evidenceCount >= 3) {
        signals.push(createFilterSignal(
          'VERIFICATION', 'ProvenanceVerificationRule',
          `多源验证通过: ${evidenceCount} 个来源覆盖 (${pub.canonical})`,
          { eventId, sourceId, evidenceCount, publisherType: pub.publisherType }
        ))
      }
    }
    return { signals }
  }
}
