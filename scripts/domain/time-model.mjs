/**
 * 时间语义模型
 * 计算 effective_at + time_precision
 */

/**
 * 计算有效时间和精度
 * @param {string|null} publishedAt - RSS 来源发布时间
 * @param {string} collectedAt - 采集时间
 * @returns {{ effective_at: string, time_precision: string }}
 */
export function computeEffectiveTime(publishedAt, collectedAt) {
  if (!publishedAt || publishedAt === 'unknown') {
    return { effective_at: collectedAt, time_precision: 'unknown' }
  }

  const precision = detectPrecision(publishedAt)
  return { effective_at: publishedAt, time_precision: precision }
}

/**
 * 检测时间字符串的精度
 * @param {string} timeStr
 * @returns {'second'|'minute'|'hour'|'day'|'unknown'}
 */
export function detectPrecision(timeStr) {
  if (!timeStr) return 'unknown'

  // ISO 8601: 2026-06-24T09:15:31Z → second
  if (/T\d{2}:\d{2}:\d{2}/.test(timeStr)) return 'second'

  // ISO 8601: 2026-06-24T09:15Z → minute
  if (/T\d{2}:\d{2}/.test(timeStr)) return 'minute'

  // ISO 8601: 2026-06-24T09Z → hour
  if (/T\d{2}/.test(timeStr)) return 'hour'

  // Date only: 2026-06-24 → day
  if (/^\d{4}-\d{2}-\d{2}/.test(timeStr)) return 'day'

  // Relative: "3 hours ago", "Yesterday" → unknown
  return 'unknown'
}
