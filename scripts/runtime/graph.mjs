/**
 * ExecutionGraph — Runtime 唯一认识的执行结构
 * 只做声明，不承载任何执行时状态
 */

/**
 * 创建 ExecutionNode
 * @param {string} taskId - Task 注册 ID
 * @param {Object} opts
 * @returns {Object} ExecutionNode
 */
export function node(taskId, opts = {}) {
  return {
    name: opts.name || taskId,
    taskId,
    condition: opts.condition || null,
    retry: opts.retry || 0,
    timeout: opts.timeout || null,
    depends: opts.depends || [],
  }
}

/**
 * 创建 ExecutionGraph
 * @param {Object[]} nodes - ExecutionNode[]
 * @returns {Object} ExecutionGraph
 */
export function createGraph(nodes) {
  return { nodes }
}
