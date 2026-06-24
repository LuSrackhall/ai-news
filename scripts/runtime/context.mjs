/**
 * ExecutionContext — 只读依赖集合
 * Task 通过 ctx 获取所有依赖，不直接 import 任何模块
 *
 * ctx.host        — Host 接口（log/invoke/metric）
 * ctx.resources   — 只读运行时数据（date/runId/pipelineName/version/config/workspace）
 * ctx.scope       — 业务依赖（events/assets/inference/policyEngine/unitOfWork/metrics）
 */

export function createExecutionContext(host, { resources, scope }) {
  return { host, resources, scope }
}
