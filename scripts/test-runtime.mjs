/**
 * v4.1 Execution Runtime 单元测试
 */

import { strict as assert } from 'node:assert'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const TEST_DATE = '2026-01-15'
const TEST_OUTPUT = join('.', 'test-output', TEST_DATE)
mkdirSync(join(TEST_OUTPUT, 'raw'), { recursive: true })

let passed = 0, failed = 0
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (e) { failed++; console.log(`  ✗ ${name}: ${e.message}`) }
}

// ── Runtime 框架测试 ──

console.log('=== Runtime 框架 ===')

import { ExecutionResult } from './runtime/result.mjs'
import { ExecutionSession } from './runtime/session.mjs'
import { TaskRegistry } from './runtime/registry.mjs'
import { node, createGraph } from './runtime/graph.mjs'
import { compile } from './runtime/compiler.mjs'

test('ExecutionResult.ok', () => {
  const r = ExecutionResult.ok({ count: 10 }, { auto: 5 })
  assert.equal(r.status, 'ok')
  assert.equal(r.outputs.count, 10)
})

test('ExecutionResult.fatal', () => {
  const r = ExecutionResult.fatal('no_data')
  assert.equal(r.status, 'fatal')
  assert.equal(r.reason, 'no_data')
})

test('ExecutionGraph 可序列化', () => {
  const graph = createGraph([node('TaskA', { name: 'A' }), node('TaskB', { name: 'B' })])
  const json = JSON.stringify(graph)
  const restored = JSON.parse(json)
  assert.equal(restored.nodes.length, 2)
  assert.equal(restored.nodes[0].taskId, 'TaskA')
})

test('GraphCompiler 编译', () => {
  const pipeline = { name: 'test', steps: [{ taskId: 'A', name: 'Alpha' }, { taskId: 'B', name: 'Beta' }] }
  const graph = compile(pipeline)
  assert.equal(graph.nodes.length, 2)
  assert.equal(graph.nodes[0].name, 'Alpha')
  assert.equal(graph.nodes[1].taskId, 'B')
})

test('GraphCompiler 校验缺少 taskId', () => {
  assert.throws(() => compile({ steps: [{ name: 'NoId' }] }), /missing taskId/)
})

test('TaskRegistry resolve 返回全新实例', () => {
  class MockTask { constructor(ctx) { this.ctx = ctx } }
  const registry = new TaskRegistry()
  registry.register('Mock', MockTask)
  const a = registry.resolve('Mock', { resources: {} })
  const b = registry.resolve('Mock', { resources: {} })
  assert.notEqual(a, b) // 不同实例
  assert.ok(a instanceof MockTask)
})

test('TaskRegistry 未知 ID 抛异常', () => {
  const registry = new TaskRegistry()
  assert.throws(() => registry.resolve('Unknown', {}), /Unknown task/)
})

test('ExecutionSession 记录结果', () => {
  const session = new ExecutionSession({ runId: 'test-1', resources: {} })
  session.addResult('step1', ExecutionResult.ok({ count: 5 }))
  session.addResult('step2', ExecutionResult.fatal('err'))
  session.finish('fatal')
  const result = session.toResult()
  assert.equal(result.status, 'fatal')
  assert.equal(result.stepResults.length, 2)
  assert.ok(result.runId)
})

// ── PolicyEngine 测试 ──

console.log('\n=== PolicyEngine ===')

import { buildPolicyEngine } from './infrastructure/policies.mjs'

test('PolicyEngine execute ranking', () => {
  const engine = buildPolicyEngine()
  const assets = [{
    id: '1', title: 'OpenAI releases GPT-5',
    summary: 'A long summary with enough text and numbers like 100 billion parameters',
    source: { tier: 1 }, publishedAt: new Date().toISOString(),
  }]
  const ranked = engine.execute('ranking', assets)
  assert.equal(ranked.length, 1)
  assert.ok(ranked[0].rank)
  assert.ok(ranked[0].rank.totalScore > 0)
})

test('PolicyEngine execute dedup', () => {
  const engine = buildPolicyEngine()
  const today = [{ id: '1', title: 'Test', url: 'https://a.com' }]
  const history = [{ id: '2', title: 'Test', url: 'https://a.com' }]
  const { kept, removed } = engine.execute('dedup', { today, history })
  assert.equal(kept.length, 0)
  assert.equal(removed.length, 1)
})

test('PolicyEngine 未知 policy 抛异常', () => {
  const engine = buildPolicyEngine()
  assert.throws(() => engine.execute('unknown', {}), /Unknown policy/)
})

// ── Repository + ReadModel 测试 ──

console.log('\n=== Repository + ReadModel ===')

import { createJsonFileStorage } from './storage/json-file-storage.mjs'
import { createEventRepository } from './repositories/event-repository.mjs'
import { createEventReadModel } from './read-models/event-read-model.mjs'

test('EventRepository store + EventReadModel load', () => {
  const storage = createJsonFileStorage(TEST_DATE)
  storage.write('_meta', { date: TEST_DATE })
  const repo = createEventRepository(storage)
  const readModel = createEventReadModel(storage)
  const events = [{ id: '1', title: 'Test' }]
  repo.store(events)
  const loaded = readModel.load()
  assert.equal(loaded.length, 1)
  assert.equal(loaded[0].id, '1')
})

test('EventReadModel load 空目录返回 []', () => {
  const storage = createJsonFileStorage('2099-01-01')
  const readModel = createEventReadModel(storage)
  assert.deepEqual(readModel.load(), [])
})

// ── 总结 ──

console.log(`\n=== 结果: ${passed} 通过, ${failed} 失败 ===`)
if (failed > 0) process.exit(1)
