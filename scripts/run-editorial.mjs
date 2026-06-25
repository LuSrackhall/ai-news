#!/usr/bin/env node
/**
 * Editorial Runtime 入口 — 纯 Node.js，不依赖 Claude Code Workflow
 *
 * 用法: node scripts/run-editorial.mjs [--date YYYY-MM-DD]
 */

import { createSqliteDatabase } from './infrastructure/database.mjs'
import { createSqliteEventRepository } from './repositories/sqlite/event-repository.mjs'
import { createSqliteEventReadModel } from './read-models/sqlite/event-read-model.mjs'
import { buildPolicyEngine } from './infrastructure/policies.mjs'
import { createNodeHost } from './hosts/node-host.mjs'
import { createInferenceService } from './services/inference-service.mjs'
import { createRuntime } from './runtime/runtime.mjs'
import { TaskRegistry } from './runtime/registry.mjs'
import { compile } from './runtime/compiler.mjs'
import { editorialPipeline } from './pipelines/editorial.mjs'

import { SelectEditorialWindow } from './tasks-editorial/select-editorial-window.mjs'
import { CurateEvents } from './tasks-editorial/curate-events.mjs'
import { GenerateArticle } from './tasks-editorial/generate-article.mjs'
import { GenerateScript } from './tasks-editorial/generate-script.mjs'
import { RenderArtifacts } from './tasks-editorial/render-artifacts.mjs'
import { ValidateOutput } from './tasks-editorial/validate-output.mjs'
import { ArchiveOutput } from './tasks-editorial/archive-output.mjs'

const args = process.argv.slice(2)
const dateArg = args.indexOf('--date')
const date = dateArg >= 0 ? args[dateArg + 1] : new Date().toISOString().slice(0, 10)

console.log(`Editorial Runtime — date: ${date}`)

// 构建依赖
const db = createSqliteDatabase()
const host = createNodeHost()
const policyEngine = buildPolicyEngine()
const inference = createInferenceService(host)

const scope = {
  events: {
    repository: createSqliteEventRepository(db),
    readModel: createSqliteEventReadModel(db),
  },
  policyEngine,
  inference,
}

const ctx = {
  host,
  resources: { date, runId: `edit-${date}-${Date.now()}`, pipelineName: 'editorial', version: 'v4.2', config: {}, workspace: '.' },
  scope,
  _events: [],
  _curatedEvents: [],
  _articleContent: null,
  _scriptContent: null,
  _articleMarkdown: null,
  _scriptMarkdown: null,
  _validation: null,
}

// 注册 Task
const registry = new TaskRegistry()
registry.registerAll({
  SelectEditorialWindow, CurateEvents, GenerateArticle, GenerateScript,
  RenderArtifacts, ValidateOutput, ArchiveOutput,
})

// 执行
const runtime = createRuntime(host, registry)
const graph = compile(editorialPipeline)
const session = await runtime.execute(graph, ctx)
const result = session.toResult()

console.log(`\nResult: ${result.status}`)
console.log(`Steps: ${result.stepResults.length}`)
console.log(JSON.stringify(result, null, 2))

db.close()
