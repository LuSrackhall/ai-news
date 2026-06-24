/**
 * AcademicRule — 学术信号评分（Bonus）
 * 热点话题/模型名/SOTA → bonus score
 */

import { ACADEMIC_SIGNALS } from '../config.mjs'

export class AcademicRule {
  name = 'academic'

  evaluate(asset) {
    const lower = (asset.title || '').toLowerCase()
    let score = 0
    if (ACADEMIC_SIGNALS.hot_topics.some((kw) => lower.includes(kw.toLowerCase()))) score += ACADEMIC_SIGNALS.hot_topic_score
    if (ACADEMIC_SIGNALS.model_names.some((kw) => lower.includes(kw.toLowerCase()))) score += ACADEMIC_SIGNALS.model_name_score
    if (ACADEMIC_SIGNALS.sota_keywords.some((kw) => lower.includes(kw.toLowerCase()))) score += ACADEMIC_SIGNALS.sota_score
    return { type: 'bonus', score: Math.min(score, 5) }
  }
}
