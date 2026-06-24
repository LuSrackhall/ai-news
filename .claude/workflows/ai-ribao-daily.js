/**
 * AI 日报 - Execution Runtime v4.1
 *
 * workflow 只做四件事：
 *   1. 构建 Host
 *   2. 构建 Scope + ExecutionContext
 *   3. 注册 Task + 编译 Pipeline
 *   4. Runtime.execute(graph, ctx)
 */

import { createClaudeHost } from './scripts/hosts/claude-host.mjs'
import { createRuntime } from './scripts/runtime/runtime.mjs'
import { createExecutionContext } from './scripts/runtime/context.mjs'
import { TaskRegistry } from './scripts/runtime/registry.mjs'
import { compile } from './scripts/runtime/compiler.mjs'
import { buildScope } from './scripts/infrastructure/scope.mjs'
import { createInferenceService } from './scripts/services/inference-service.mjs'
import { dailyPipeline } from './scripts/pipelines/daily.mjs'
import { CollectAssets } from './scripts/tasks/collect-assets.mjs'
import { VerifyAssets } from './scripts/tasks/verify-assets.mjs'
import { ScoreEvents } from './scripts/tasks/score-events.mjs'
import { DedupEvents } from './scripts/tasks/dedup-events.mjs'
import { CurateEvents } from './scripts/tasks/curate-events.mjs'
import { GenerateArticle } from './scripts/tasks/generate-article.mjs'
import { GenerateScript } from './scripts/tasks/generate-script.mjs'
import { RenderArtifacts } from './scripts/tasks/render-artifacts.mjs'
import { ValidateOutput } from './scripts/tasks/validate-output.mjs'
import { ArchiveOutput } from './scripts/tasks/archive-output.mjs'

export const meta = {
  name: 'ai-ribao-daily',
  description: 'AI 日报 - Execution Runtime v4.1',
  phases: [{ title: '执行', detail: 'Runtime 自动调度所有 Task' }],
}

const host = createClaudeHost({ phase, agent, log })
const date = (args && args.date) || new Date().toISOString().slice(0, 10)
const scope = buildScope(host, date)
scope.inference = createInferenceService(host)

const ctx = createExecutionContext(host, {
  resources: { date, runId: `run-${date}-${Date.now()}`, pipelineName: 'daily', version: 'v4.1', config: {}, workspace: '.' },
  scope,
})

const registry = new TaskRegistry()
registry.registerAll({
  CollectAssets, VerifyAssets, ScoreEvents, DedupEvents, CurateEvents,
  GenerateArticle, GenerateScript, RenderArtifacts, ValidateOutput, ArchiveOutput,
})

const runtime = createRuntime(host, registry)
const session = await runtime.execute(compile(dailyPipeline), ctx)
return session.toResult()
