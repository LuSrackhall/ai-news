/**
 * evidence/keywords.mjs — 从事件生成关键词列表
 *
 * 确定性逻辑：从事件 title + summary + entities 提取关键词。
 * 支持中英文混合内容。
 */

/**
 * 从事件提取关键词
 * @param {object} event — { title, summary, entities }
 * @returns {string[]} 关键词数组（去重、降序按长度）
 */
export function extractKeywords(event) {
  if (!event) return []

  const words = new Set()
  const title = event.title || ''
  const summary = event.summary || ''
  const entities = event.entities || []
  const text = `${title} ${summary}`

  // 从 title 中提取显著英文词（>=4 字母的首字母大写词 + 全部大写缩写）
  const titleWords = title.match(/\b[A-Z][a-z]{2,}\b/g) || []
  for (const w of titleWords) words.add(w)

  const acronyms = title.match(/\b[A-Z]{2,5}\b/g) || []
  for (const w of acronyms) words.add(w)

  // 从 entities 提取实体名
  for (const e of entities) {
    if (typeof e === 'string') words.add(e)
  }

  // 提取中文字句（含关键实体的短句）
  const chinesePhrases = text.match(/[^\x00-\x7F]{2,10}/g) || []
  for (const p of chinesePhrases) {
    // 只保留含已知实体或英文关键词的中文短语
    if (entities.some(e => typeof e === 'string' && p.includes(e))) {
      words.add(p.trim())
    }
  }

  return [...words].sort((a, b) => b.length - a.length).slice(0, 15)
}
