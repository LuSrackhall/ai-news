/**
 * Agent Service — 封装 Claude Code 的 agent() 原语
 * 含 JSON 解析兜底 + 一次重试逻辑（从 v3 workflow 迁移）
 */

export function createAgentService(runtime) {
  /**
   * 尝试从文本中提取 JSON 对象
   */
  function parseJsonFallback(text) {
    try { return JSON.parse(text) } catch {}
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try { return JSON.parse(text.slice(start, end + 1)) } catch {}
    }
    return null
  }

  return {
    /**
     * 普通 agent 调用（如执行外部脚本）
     */
    async call(prompt, opts = {}) {
      return runtime.llm.agent(prompt, opts)
    },

    /**
     * 带 schema 的结构化生成，含 JSON 解析兜底 + 一次重试
     * @param {string} prompt - 完整 prompt
     * @param {Object} schema - JSON Schema
     * @param {Object} opts - 附加选项（model, label, phase 等）
     * @returns {Object|null}
     */
    async generate(prompt, schema, opts = {}) {
      const result = await runtime.llm.agent(prompt, { ...opts, schema })

      // 直接是对象（structured output）
      if (typeof result === 'object' && result !== null) return result

      // JSON 解析兜底
      const parsed = parseJsonFallback(String(result))
      if (parsed) return parsed

      // 重试一次（缩短 prompt）
      if (opts.retryOnFail !== false) {
        const retryResult = await runtime.llm.agent(
          prompt.length > 15000 ? prompt.slice(0, 15000) : prompt,
          { ...opts, schema }
        )
        if (typeof retryResult === 'object' && retryResult !== null) return retryResult
        return parseJsonFallback(String(retryResult))
      }

      return null
    },
  }
}
