#!/usr/bin/env node
/**
 * Ingestion Runtime 入口 — 纯 Node.js，不依赖 Claude Code Workflow
 *
 * 用法: node scripts/run-ingestion.mjs [--date YYYY-MM-DD]
 */

import { createSqliteDatabase } from './infrastructure/database.mjs'
import { createSqliteEventRepository } from './repositories/sqlite/event-repository.mjs'
import { createSqliteEventReadModel } from './read-models/sqlite/event-read-model.mjs'
import { buildPolicyEngine } from './infrastructure/policies.mjs'
import { createRuntime } from './runtime/runtime.mjs'
import { TaskRegistry } from './runtime/registry.mjs'
import { compile } from './runtime/compiler.mjs'
import { ingestionPipeline } from './pipelines/ingestion.mjs'

import { CollectAssets } from './tasks-ingestion/collect-assets.mjs'
import { NormalizeAssets } from './tasks-ingestion/normalize-assets.mjs'
import { VerifyAssets } from './tasks-ingestion/verify-assets.mjs'
import { ExtractEntities } from './tasks-ingestion/extract-entities.mjs'
import { ScoreEvents } from './tasks-ingestion/score-events.mjs'
import { DedupEvents } from './tasks-ingestion/dedup-events.mjs'
import { StoreEvents } from './tasks-ingestion/store-events.mjs'

const args = process.argv.slice(2)
const dateArg = args.indexOf('--date')
const date = dateArg >= 0 ? args[dateArg + 1] : new Date().toISOString().slice(0, 10)

console.log(`Ingestion Runtime — date: ${date}`)

// 构建依赖
const db = createSqliteDatabase()
const policyEngine = buildPolicyEngine()

// Ingestion 不需要 LLM，用简单 console host
const host = {
  log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`) },
  async invoke() { throw new Error('Ingestion does not use LLM') },
  metric() {},
  now() { return new Date().toISOString() },
  elapsed(startMs) { return Date.now() - startMs },
}

const scope = {
  events: {
    repository: createSqliteEventRepository(db),
    readModel: createSqliteEventReadModel(db),
  },
  policyEngine,
  inference: null, // Ingestion 不需要 LLM
}

const ctx = {
  host,
  resources: { date, runId: `ingest-${date}-${Date.now()}`, pipelineName: 'ingestion', version: 'v4.2', config: {}, workspace: '.' },
  scope,
  _assets: [], // Task 间临时数据传递
}

// 注册 Task
const registry = new TaskRegistry()
registry.registerAll({
  CollectAssets, NormalizeAssets, VerifyAssets, ExtractEntities,
  ScoreEvents, DedupEvents, StoreEvents,
})

// 执行
const runtime = createRuntime(host, registry)
const graph = compile(ingestionPipeline)
const session = await runtime.execute(graph, ctx)
const result = session.toResult()

console.log(`\nResult: ${result.status}`)
console.log(`Steps: ${result.stepResults.length}`)
console.log(JSON.stringify(result, null, 2))

db.close()
