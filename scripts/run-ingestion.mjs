#!/usr/bin/env node
/**
 * Ingestion Runtime 入口 — 纯 Node.js，不依赖 Claude Code Workflow
 *
 * 用法: node scripts/run-ingestion.mjs [--date YYYY-MM-DD]
 */

import { createSqliteDatabase } from './infrastructure/database.mjs'
import { createSqliteEventRepository } from './repositories/sqlite/event-repository.mjs'
import { createSqliteClusterRepository } from './repositories/sqlite/cluster-repository.mjs'
import { createSqliteEventReadModel } from './read-models/sqlite/event-read-model.mjs'
import { createSqliteClusterReadModel } from './read-models/sqlite/cluster-read-model.mjs'
import { buildPolicyEngine } from './infrastructure/policies.mjs'
import { createRuntime } from './runtime/runtime.mjs'
import { TaskRegistry } from './runtime/registry.mjs'
import { compile } from './runtime/compiler.mjs'
import { ingestionPipeline } from './pipelines/ingestion.mjs'

import { CollectAssets } from './tasks-ingestion/collect-assets.mjs'
import { NormalizeAssets } from './tasks-ingestion/normalize-assets.mjs'
import { BuildProvenanceEdges } from './tasks-ingestion/build-provenance-edges.mjs'
import { FilterGitHubNoise } from './tasks-ingestion/filter-github-noise.mjs'
import { VerifyAssets } from './tasks-ingestion/verify-assets.mjs'
import { ExtractEntities } from './tasks-ingestion/extract-entities.mjs'
import { ClusterEvents } from './tasks-ingestion/cluster-events.mjs'
import { ScoreEvents } from './tasks-ingestion/score-events.mjs'
import { DedupEvents } from './tasks-ingestion/dedup-events.mjs'
import { StoreEvents } from './tasks-ingestion/store-events.mjs'

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 读取 cron.log，解析所有 JSON 条目，加上当前 result，重写 data/runs.md
 */
function extractJsonObjects(text) {
  const objects = []
  let depth = 0, start = -1
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') { if (depth === 0) start = i; depth++ }
    else if (text[i] === '}') {
      depth--
      if (depth === 0 && start >= 0) {
        try { const obj = JSON.parse(text.slice(start, i + 1)); if (obj.runId) objects.push(obj) } catch {}
        start = -1
      }
    }
  }
  return objects
}

function updateRunsMd(currentResult) {
  try {
    const logPath = join('.', 'data', 'cron.log')
    const runsPath = join('.', 'data', 'runs.md')

    // 解析历史记录
    let rawLog = ''
    try { rawLog = readFileSync(logPath, 'utf-8') } catch {}
    const runs = extractJsonObjects(rawLog)

    // 追加本次运行（cron.log 此时还未写入当前 JSON）
    runs.push(currentResult)

    // 构建表格
    const pad = (n) => String(n).padStart(2, '0')

    let md = '# 后台运行记录\n\n'
    md += '| # | CST 时间 | 状态 | 耗时 | 采集 | 过滤 | 验证 | 实体 | 入库 |\n'
    md += '|---|---------|------|------|------|------|------|------|------|\n'

    let count = 0
    for (const run of runs) {
      count++
      const dt = new Date(run.startedAt)
      const ts = `${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
      const status = run.status === 'success' ? '✅' : '❌'
      const dur = `${Math.round(run.duration / 1000)}s`

      const m = {}
      for (const s of (run.stepResults || [])) {
        const outputs = s.outputs || {}
        const name = s.stepName
        if (name === '采集') m.collect = `${outputs.assets_count ?? '-'}/${s.metrics?.raw_count ?? '-'}`
        else if (name === '噪音过滤') m.filter = outputs.filtered ?? '-'
        else if (name === '验证') m.verify = outputs.valid ?? '-'
        else if (name === '实体提取') m.entity = outputs.extracted ?? '-'
        else if (name === '入库') m.store = outputs.stored ?? '-'
      }

      md += `| ${count} | ${ts} | ${status} | ${dur} | ${m.collect || '-'} | ${m.filter || '-'} | ${m.verify || '-'} | ${m.entity || '-'} | ${m.store || '-'} |\n`
    }

    writeFileSync(runsPath, md, 'utf-8')
  } catch (err) {
    console.error(`[runs.md] 写入失败: ${err.message}`)
  }
}

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
    clusterRepository: createSqliteClusterRepository(db),
    readModel: createSqliteEventReadModel(db),
    clusterReadModel: createSqliteClusterReadModel(db),
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
  CollectAssets, NormalizeAssets, FilterGitHubNoise, VerifyAssets, ExtractEntities,
  ClusterEvents, ScoreEvents, DedupEvents, StoreEvents,
})

// 执行
const runtime = createRuntime(host, registry)
const graph = compile(ingestionPipeline)
const session = await runtime.execute(graph, ctx)
const result = session.toResult()

console.log(`\nResult: ${result.status}`)
console.log(`Steps: ${result.stepResults.length}`)
console.log(JSON.stringify(result, null, 2))

// 更新运行状态表格
updateRunsMd(result)

db.close()
