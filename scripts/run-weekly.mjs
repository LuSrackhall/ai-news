#!/usr/bin/env node
/**
 * Weekly Runtime 入口 — 纯 Node.js
 *
 * 用法: node scripts/run-weekly.mjs [--week YYYY-MM-DD]
 *
 * 不依赖 Claude Code Workflow。无 ANTHROPIC_API_KEY 时跳过 LLM 生成，使用默认模板。
 */

import { createSqliteDatabase } from './infrastructure/database.mjs'
import { createSqliteEventRepository } from './repositories/sqlite/event-repository.mjs'
import { createSqliteClusterRepository } from './repositories/sqlite/cluster-repository.mjs'
import { createSqliteWeeklyReportRepository } from './repositories/sqlite/weekly-report-repository.mjs'
import { createSqliteEventReadModel } from './read-models/sqlite/event-read-model.mjs'
import { createSqliteClusterReadModel } from './read-models/sqlite/cluster-read-model.mjs'
import { buildPolicyEngine } from './infrastructure/policies.mjs'
import { createRuntime } from './runtime/runtime.mjs'
import { TaskRegistry } from './runtime/registry.mjs'
import { compile } from './runtime/compiler.mjs'
import { weeklyPipeline } from './pipelines/weekly.mjs'

import { LoadWeekEvents } from './tasks-weekly/load-week-events.mjs'
import { AggregateByCluster } from './tasks-weekly/aggregate-by-cluster.mjs'
import { GenerateWeeklyArticle } from './tasks-weekly/generate-weekly-article.mjs'
import { RenderWeekly } from './tasks-weekly/render-weekly.mjs'
import { ArchiveWeekly } from './tasks-weekly/archive-weekly.mjs'

const args = process.argv.slice(2)
const dateArg = args.indexOf('--week')
const date = dateArg >= 0 ? args[dateArg + 1] : new Date().toISOString().slice(0, 10)

console.log(`Weekly Runtime — date: ${date}`)

// 构建依赖
const db = createSqliteDatabase()
const policyEngine = buildPolicyEngine()

// Weekly 不强制要求 LLM，无 key 时跳过生成
const hasLLM = !!process.env.ANTHROPIC_API_KEY
const host = {
  log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`) },
  async invoke(prompt) {
    if (!hasLLM) throw new Error('No ANTHROPIC_API_KEY')
    // 简单调用，实际由 inference service 处理
    throw new Error('Use inference service instead of host.invoke directly')
  },
  metric() {},
  now() { return new Date().toISOString() },
  elapsed(startMs) { return Date.now() - startMs },
}

const scope = {
  events: {
    repository: createSqliteEventRepository(db),
    clusterRepository: createSqliteClusterRepository(db),
    weeklyReportRepository: createSqliteWeeklyReportRepository(db),
    readModel: createSqliteEventReadModel(db),
    clusterReadModel: createSqliteClusterReadModel(db),
  },
  policyEngine,
  inference: null,
}

const ctx = {
  host,
  resources: {
    date,
    runId: `weekly-${date}-${Date.now()}`,
    pipelineName: 'weekly',
    version: 'v4.4',
    config: {},
    workspace: '.',
  },
  scope,
  _weekEvents: [],
  _clusters: [],
  _rendered: {},
}

// 注册 Task
const registry = new TaskRegistry()
registry.registerAll({
  LoadWeekEvents, AggregateByCluster, GenerateWeeklyArticle,
  RenderWeekly, ArchiveWeekly,
})

// 执行
const runtime = createRuntime(host, registry)
const graph = compile(weeklyPipeline)
const session = await runtime.execute(graph, ctx)
const result = session.toResult()

console.log(`\nResult: ${result.status}`)
console.log(`Steps: ${result.stepResults.length}`)
console.log(`Archive: ${ctx._archivePath || 'N/A'}`)

db.close()
