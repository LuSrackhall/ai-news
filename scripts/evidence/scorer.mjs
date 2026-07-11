/**
 * evidence/scorer.mjs — 证据评分器
 *
 * 三因子等权平均：
 * 1. KeywordMatchScore — DOM 关键词命中密度
 * 2. SourceAuthorityScore — 信源权威性（ProvenanceAlias trust_score）
 * 3. ProvenanceCrosscheckScore — 同一事件多源交叉验证
 *
 * 确定性逻辑，不依赖 LLM。
 */

/**
 * 计算关键词匹配得分
 * @param {number} matchCount — 命中关键词数
 * @param {number} totalKeywords — 总关键词数
 * @returns {number} 0.0 ~ 1.0
 */
export function calcKeywordMatchScore(matchCount, totalKeywords) {
  if (!totalKeywords) return 0
  return Math.min(matchCount / totalKeywords, 1.0)
}

/**
 * 计算信源权威得分
 * @param {number} trustScore — ProvenanceAlias trust_score（1-5）
 * @returns {number} 0.0 ~ 1.0
 */
export function calcSourceAuthorityScore(trustScore) {
  if (trustScore == null) return 0.3 // 未知信源给默认低分
  return Math.min(trustScore / 5, 1.0)
}

/**
 * 计算多源交叉验证得分
 * @param {number} duplicateCount — duplicate_of 边数（同一事件被多少同来源覆盖）
 * @returns {number} 0.0 ~ 1.0
 */
export function calcProvenanceCrosscheckScore(duplicateCount) {
  if (!duplicateCount) return 0
  // 3+ 信源覆盖 → 满分，1个信源 → 0.33
  return Math.min(duplicateCount / 3, 1.0)
}

/**
 * 整合评分（等权平均）
 * @param {object} scores - { keywordMatch, sourceAuthority, provenanceCrosscheck }
 * @returns {number} 0.0 ~ 1.0
 */
export function calcOverallScore(scores) {
  const { keywordMatch = 0, sourceAuthority = 0, provenanceCrosscheck = 0 } = scores
  const total = keywordMatch + sourceAuthority + provenanceCrosscheck
  return Math.round((total / 3) * 100) / 100
}

/**
 * 对 evidence 执行完整评分
 * 返回修改后的 scoring 对象
 *
 * @param {object} evidence — evidence 对象
 * @param {object} ctx
 * @param {number} [ctx.trustScore] — 从 ProvenanceService 查询的 trust_score
 * @param {number} [ctx.duplicateCount] — 从 ProvenanceService 查询的 duplicate_of 边数
 * @returns {object} — { keywordMatch, sourceAuthority, provenanceCrosscheck, overall }
 */
export function scoreEvidence(evidence, ctx = {}) {
  const totalKeywords = evidence.method?.keywords?.length || 0
  const matchCount = evidence.scoring?.keyword_match
    ? Math.round(evidence.scoring.keyword_match * totalKeywords)
    : 0

  const keywordMatch = calcKeywordMatchScore(matchCount, totalKeywords)
  const sourceAuthority = calcSourceAuthorityScore(ctx.trustScore)
  const provenanceCrosscheck = calcProvenanceCrosscheckScore(ctx.duplicateCount)
  const overall = calcOverallScore({ keywordMatch, sourceAuthority, provenanceCrosscheck })

  return { keywordMatch, sourceAuthority, provenanceCrosscheck, overall }
}
