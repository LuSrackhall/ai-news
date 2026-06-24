/**
 * ClaudeHost — Claude Code Workflow 适配
 * 封装 phase/agent/log 原语为 Host 接口
 */

export function createClaudeHost(workflowRuntime) {
  return {
    log(msg) { workflowRuntime.log(msg) },

    async invoke(prompt, opts = {}) {
      return workflowRuntime.agent(prompt, opts)
    },

    metric(key, value) {
      // v4.1 最简实现：日志输出
      // v4.2+ 可接入 metrics backend
    },

    now() { return new Date().toISOString() },

    elapsed(startMs) { return Date.now() - startMs },
  }
}
