/**
 * Runtime — 执行引擎
 * 接收 ExecutionGraph → 通过 TaskRegistry 解析 Task → 驱动执行
 * Runtime 只认识 Task / ExecutionGraph / ExecutionContext
 */

import { ExecutionResult } from './result.mjs'
import { ExecutionSession } from './session.mjs'

/**
 * 创建 Runtime
 * @param {Object} host - Host 接口
 * @param {Object} registry - TaskRegistry
 * @returns {{ execute(graph, ctx) }}
 */
export function createRuntime(host, registry) {
  return {
    async execute(graph, ctx) {
      const session = new ExecutionSession({
        runId: ctx.resources.runId,
        resources: ctx.resources,
      })

      for (const n of graph.nodes) {
        host.log(`▶ ${n.name}`)
        const started = Date.now()
        let result

        try {
          // 每次 resolve 返回全新实例（不复用、不缓存）
          const task = registry.resolve(n.taskId, ctx)
          result = await task.execute(ctx)
        } catch (err) {
          result = ExecutionResult.fatal(err.message)
        }

        result.duration = host.elapsed(started)
        result.stepName = n.name
        session.addResult(n.name, result)

        if (result.status === 'fatal') {
          host.log(`❌ Fatal @ ${n.name}: ${result.reason}`)
          session.finish('fatal')
          return session
        }
      }

      session.finish('success')
      return session
    },
  }
}
