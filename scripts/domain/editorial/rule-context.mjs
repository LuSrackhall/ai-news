/**
 * RuleContext — 提供跨 Rule 的共享上下文
 *
 * RuleContext 是只读的——Rule 之间不通过它通信。
 * date 和 memoryStore 是核心字段，Phase 2+ 可扩展 config。
 */

/**
 * 构造 RuleContext
 * @param {Object} opts
 * @param {string} opts.date — ISO 日期字符串
 * @param {Object} [opts.memoryStore] — EditorialMemoryStore 实例
 * @returns {Object} RuleContext
 */
export function createRuleContext({ date, memoryStore }) {
  return {
    date: date || new Date().toISOString().slice(0, 10),
    memoryStore: memoryStore || null,
  }
}
