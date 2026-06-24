/**
 * GraphCompiler — 声明式输入 → ExecutionGraph
 * 只做静态展开和校验，不做执行期逻辑
 */

import { node, createGraph } from './graph.mjs'

/**
 * 编译 Pipeline 声明为 ExecutionGraph
 * @param {Object} pipeline - { name, steps: [{ taskId, name, retry, ... }] }
 * @returns {Object} ExecutionGraph
 */
export function compile(pipeline) {
  if (!pipeline || !Array.isArray(pipeline.steps)) {
    throw new Error('Invalid pipeline: missing steps array')
  }

  const nodes = pipeline.steps.map(step => {
    if (!step.taskId) throw new Error(`Step missing taskId: ${JSON.stringify(step)}`)
    return node(step.taskId, {
      name: step.name || step.taskId,
      condition: step.condition || null,
      retry: step.retry || 0,
      timeout: step.timeout || null,
      depends: step.depends || [],
    })
  })

  return createGraph(nodes)
}
