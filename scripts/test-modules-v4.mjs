/**
 * AI 日报 - Pipeline v4 单元测试
 * 覆盖：Store / Domain / Adapter / PhaseResult
 */

import { strict as assert } from 'node:assert'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const TEST_DATE = '2026-01-15'
const TEST_OUTPUT = join('.', 'test-output', TEST_DATE)

// ── 测试工具 ──

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    failed++
    console.log(`  ✗ ${name}: ${e.message}`)
  }
}

function setup() {
  mkdirSync(join(TEST_OUTPUT, 'raw'), { recursive: true })
}

function cleanup() {
  try {
    const { rmSync } = require('node:fs')
    rmSync(join('.', 'test-output'), { recursive: true, force: true })
  } catch {}
}

// ── PhaseResult 测试 ──

console.log('\n=== PhaseResult 测试 ===')

import { PhaseResult } from './engine/phase-result.mjs'

test('PhaseResult.ok() 创建成功结果', () => {
  const r = PhaseResult.ok({ count: 10 })
  assert.equal(r.status, 'ok')
  assert.equal(r.metrics.count, 10)
  assert.equal(r.duration, null)
})

test('PhaseResult.fatal() 创建致命错误', () => {
  const r = PhaseResult.fatal('no_data')
  assert.equal(r.status, 'fatal')
  assert.equal(r.reason, 'no_data')
})

test('PhaseResult.warn() 创建警告结果', () => {
  const r = PhaseResult.warn({ count: 5 }, 'low_quality')
  assert.equal(r.status, 'warn')
  assert.equal(r.warnings[0], 'low_quality')
})

test('PhaseResult.skipped() 创建跳过结果', () => {
  const r = PhaseResult.skipped('already_cached')
  assert.equal(r.status, 'skipped')
})

// ── Store 测试 ──

console.log('\n=== Store 测试 ===')

// 创建 mock environment
const mockEnv = {
  date: TEST_DATE,
  workspace: '.',
  config: { outputDir: 'test-output' },
  clock: { now: () => new Date().toISOString(), elapsed: (s) => Date.now() - s },
}

setup()

import { createAssetStore } from './stores/assets.mjs'
import { createEventStore } from './stores/events.mjs'
import { createArtifactStore } from './stores/artifacts.mjs'

test('AssetStore save/load', () => {
  const store = createAssetStore(mockEnv)
  const items = [{ id: '1', title: 'Test', url: 'https://example.com' }]
  store.save(items)
  const loaded = store.load()
  assert.equal(loaded.length, 1)
  assert.equal(loaded[0].id, '1')
})

test('AssetStore load 空目录返回 []', () => {
  const store = createAssetStore({ ...mockEnv, date: '2099-01-01' })
  const loaded = store.load()
  assert.deepEqual(loaded, [])
})

test('AssetStore append', () => {
  const store = createAssetStore(mockEnv)
  store.save([{ id: '1' }])
  store.append([{ id: '2' }])
  const loaded = store.load()
  assert.equal(loaded.length, 2)
})

test('ArtifactStore save/load by type', () => {
  const store = createArtifactStore(mockEnv)
  store.save('article', { type: 'article', content: { hook: 'test' }, rendered: null, meta: {} })
  const loaded = store.load('article')
  assert.equal(loaded.type, 'article')
  assert.equal(loaded.content.hook, 'test')
  assert.equal(store.load('nonexistent'), null)
})

test('ArtifactStore loadMarkdown', () => {
  const store = createArtifactStore(mockEnv)
  store.save('article', { type: 'article', rendered: { markdown: '# Hello' } })
  assert.equal(store.loadMarkdown('article'), '# Hello')
  assert.equal(store.loadMarkdown('nonexistent'), null)
})

// ── Adapter 测试 ──

console.log('\n=== Adapter 测试 ===')

import { adaptV3CuratedToEvents } from './engine/adapters/v3-compat.mjs'
import { adaptEventsToV3Curated } from './engine/adapters/v4-compat.mjs'

test('adaptV3CuratedToEvents 正常转换', () => {
  const v3 = {
    date: '2026-01-15',
    selected_items: [{
      id: 'test-1',
      title: 'OpenAI 发布 GPT-6',
      url: 'https://openai.com/gpt6',
      source_name: 'OpenAI Blog',
      source_tier: 1,
      published_at: '2026-01-15T10:00:00Z',
      summary_zh: 'GPT-6 正式发布',
      total_score: 85,
      tier_label: 'auto',
      importance: 'deep',
      curation_note: '重大发布',
    }],
  }
  const events = adaptV3CuratedToEvents(v3)
  assert.equal(events.length, 1)
  assert.equal(events[0].title, 'OpenAI 发布 GPT-6')
  assert.equal(events[0].summary, 'GPT-6 正式发布')
  assert.equal(events[0].sources[0].name, 'OpenAI Blog')
  assert.equal(events[0].rank.totalScore, 85)
  assert.equal(events[0].curation.importance, 'deep')
  assert.equal(events[0].metadata.v3Source, true)
})

test('adaptV3CuratedToEvents 空数据返回 []', () => {
  assert.deepEqual(adaptV3CuratedToEvents(null), [])
  assert.deepEqual(adaptV3CuratedToEvents({}), [])
  assert.deepEqual(adaptV3CuratedToEvents({ selected_items: null }), [])
})

test('adaptEventsToV3Curated 转换回 v3 格式', () => {
  const events = [{
    id: 'e1',
    title: 'Test',
    url: 'https://test.com',
    sources: [{ name: 'Source', tier: 1, url: 'https://test.com', publishedAt: '2026-01-15' }],
    summary: 'Summary',
    rank: { baseScore: 50, bonusScore: 20, totalScore: 70, tierLabel: 'auto' },
    curation: { importance: 'deep', note: 'note' },
    metadata: { category: 'official' },
  }]
  const v3 = adaptEventsToV3Curated(events, '2026-01-15')
  assert.equal(v3.selected_items.length, 1)
  assert.equal(v3.selected_items[0].summary_zh, 'Summary')
  assert.equal(v3.selected_items[0].importance, 'deep')
})

// ── Ranking Domain 测试 ──

console.log('\n=== Ranking Domain 测试 ===')

import { createRankingDomain } from './domain/ranking.mjs'

const rankingCtx = {
  stores: {},
  services: {},
  environment: mockEnv,
}

test('ranking.scoreAll 评分结果包含 rank 字段', () => {
  const domain = createRankingDomain(rankingCtx)
  const items = [{
    id: '1',
    title: 'OpenAI releases GPT-5',
    url: 'https://openai.com',
    summary: 'A long summary with enough text to pass quality checks and contain numbers like 100 billion parameters',
    tier: 1,
    publishedAt: new Date().toISOString(),
    source: { name: 'OpenAI', tier: 1 },
  }]
  const scored = domain.scoreAll(items)
  assert.equal(scored.length, 1)
  assert.ok(scored[0].rank)
  assert.ok(scored[0].rank.totalScore > 0)
  assert.ok(['auto', 'review', 'skip'].includes(scored[0].rank.tierLabel))
})

test('ranking.classify 分级正确', () => {
  const domain = createRankingDomain(rankingCtx)
  const scored = [
    { rank: { totalScore: 80, tierLabel: 'auto' } },
    { rank: { totalScore: 60, tierLabel: 'review' } },
    { rank: { totalScore: 30, tierLabel: 'skip' } },
  ]
  const { auto, review, skip } = domain.classify(scored)
  assert.equal(auto.length, 1)
  assert.equal(review.length, 1)
  assert.equal(skip.length, 1)
})

test('ranking.buildEvents 输出 Event 结构', () => {
  const domain = createRankingDomain(rankingCtx)
  const assets = [{
    id: '1',
    title: 'Test',
    summary: 'Summary',
    url: 'https://test.com',
    publishedAt: '2026-01-15',
    source: { name: 'Source', tier: 1 },
    rank: { totalScore: 75, tierLabel: 'auto' },
    contentHash: 'sha256:abc123',
  }]
  const events = domain.buildEvents(assets)
  assert.equal(events.length, 1)
  assert.equal(events[0].type, 'news')
  assert.equal(events[0].sources.length, 1)
  assert.equal(events[0].assetIds[0], '1')
  assert.equal(events[0].clusterId, null)
  assert.deepEqual(events[0].entities, [])
  assert.equal(events[0].rank.totalScore, 75)
})

// ── 总结 ──

console.log(`\n=== 测试结果: ${passed} 通过, ${failed} 失败 ===`)
if (failed > 0) process.exit(1)
