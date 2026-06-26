/**
 * SQLite 基础设施测试
 */

import { strict as assert } from 'node:assert'
import { existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const TEST_DB = join('.', 'data', 'test-events.db')

let passed = 0, failed = 0
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (e) { failed++; console.log(`  ✗ ${name}: ${e.message}`) }
}

console.log('=== SQLite 测试 ===')

// 清理
try { unlinkSync(TEST_DB) } catch {}

const { createSqliteDatabase } = await import('./infrastructure/database.mjs')
const { createSqliteEventRepository } = await import('./repositories/sqlite/event-repository.mjs')
const { createSqliteEventReadModel } = await import('./read-models/sqlite/event-read-model.mjs')

const db = createSqliteDatabase(TEST_DB)
const repo = createSqliteEventRepository(db)
const readModel = createSqliteEventReadModel(db)

// v4.4: 新增依赖
const { createSqliteClusterRepository } = await import('./repositories/sqlite/cluster-repository.mjs')
const { createSqliteClusterReadModel } = await import('./read-models/sqlite/cluster-read-model.mjs')
const { createSqliteFeedbackRepository } = await import('./repositories/sqlite/feedback-repository.mjs')

const clusterRepo = createSqliteClusterRepository(db)
const clusterReadModel = createSqliteClusterReadModel(db)
const feedbackRepo = createSqliteFeedbackRepository(db)

// 建表
test('数据库创建成功', () => {
  assert.ok(existsSync(TEST_DB))
})

test('events 表存在', () => {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
  const names = tables.map(t => t.name)
  assert.ok(names.includes('events'))
  assert.ok(names.includes('event_entities'))
  assert.ok(names.includes('event_topics'))
  assert.ok(names.includes('event_clusters'))
  assert.ok(names.includes('weekly_reports'))
  assert.ok(names.includes('feedback'))
})

// 写入
test('store 单条 Event', () => {
  const changes = repo.store({
    id: 'test-1',
    type: 'news',
    title: 'OpenAI 发布 GPT-6',
    summary: 'GPT-6 正式发布',
    url: 'https://openai.com/gpt6',
    contentHash: 'sha256:abc123',
    publishedAt: '2026-06-24T09:00:00Z',
    collectedAt: '2026-06-24T09:05:00Z',
    effectiveAt: '2026-06-24T09:00:00Z',
    timePrecision: 'second',
    rank: { totalScore: 85, tierLabel: 'auto' },
    source: { name: 'OpenAI Blog', tier: 1 },
    entities: ['OpenAI', 'GPT-6'],
    topics: ['LLM'],
  })
  assert.equal(changes, 1)
})

test('重复 content_hash 被忽略', () => {
  const changes = repo.store({
    id: 'test-1-dup',
    title: 'OpenAI 发布 GPT-6（重复）',
    contentHash: 'sha256:abc123',
    collectedAt: '2026-06-24T09:05:00Z',
    effectiveAt: '2026-06-24T09:00:00Z',
    timePrecision: 'second',
  })
  assert.equal(changes, 0) // INSERT OR IGNORE
})

test('storeBatch 批量写入', () => {
  const changes = repo.storeBatch([
    { id: 'test-2', title: 'Google Gemini 3', contentHash: 'sha256:def456', collectedAt: '2026-06-24T10:00:00Z', effectiveAt: '2026-06-24T10:00:00Z', timePrecision: 'second', entities: ['Google'] },
    { id: 'test-3', title: 'Anthropic Claude 5', contentHash: 'sha256:ghi789', collectedAt: '2026-06-24T11:00:00Z', effectiveAt: '2026-06-24T11:00:00Z', timePrecision: 'second', entities: ['Anthropic'] },
  ])
  assert.equal(changes, 2)
})

// 查询
test('findByWindow 查询', () => {
  const events = readModel.findByWindow('2026-06-24T00:00:00Z', '2026-06-25T00:00:00Z')
  assert.equal(events.length, 3)
  assert.equal(events[0].title, 'OpenAI 发布 GPT-6')
})

test('findByEntity 查询', () => {
  const events = readModel.findByEntity('OpenAI')
  assert.equal(events.length, 1)
  assert.equal(events[0].id, 'test-1')
})

test('findByTopic 查询', () => {
  const events = readModel.findByTopic('LLM')
  assert.equal(events.length, 1)
})

test('existsByHash 检查', () => {
  assert.ok(readModel.existsByHash('sha256:abc123'))
  assert.ok(!readModel.existsByHash('sha256:nonexistent'))
})

test('count 统计', () => {
  assert.equal(readModel.count(), 3)
})

// 实体关系表
test('event_entities 写入正确', () => {
  const entities = db.prepare('SELECT entity FROM event_entities WHERE event_id = ?').all('test-1')
  assert.equal(entities.length, 2)
  assert.ok(entities.some(e => e.entity === 'OpenAI'))
  assert.ok(entities.some(e => e.entity === 'GPT-6'))
})

test('event_topics 写入正确', () => {
  const topics = db.prepare('SELECT topic FROM event_topics WHERE event_id = ?').all('test-1')
  assert.equal(topics.length, 1)
  assert.equal(topics[0].topic, 'LLM')
})

// === v4.4: 新表测试 ===

// event_clusters
test('clusterRepository.store 写入 Cluster', () => {
  const changes = clusterRepo.store({
    id: 'cluster-001',
    title: 'OpenAI GPT-6 发布',
    type: 'auto',
    importance: 'high',
    event_count: 2,
    entity_keys: ['OpenAI', 'GPT-6'],
    topic_keys: ['LLM'],
    first_seen: '2026-06-24T09:00:00Z',
    last_updated: '2026-06-24T10:00:00Z',
  })
  assert.equal(changes, 1)
})

test('clusterReadModel.findAll 查询', () => {
  const clusters = clusterReadModel.findAll()
  assert.equal(clusters.length, 1)
  assert.equal(clusters[0].title, 'OpenAI GPT-6 发布')
  assert.ok(Array.isArray(clusters[0].entity_keys))
  assert.ok(clusters[0].entity_keys.includes('OpenAI'))
})

test('clusterReadModel.findByEntity 查询', () => {
  const clusters = clusterReadModel.findByEntity('OpenAI')
  assert.equal(clusters.length, 1)
})

test('clusterReadModel.findByDateRange 查询', () => {
  const clusters = clusterReadModel.findByDateRange('2026-06-24T00:00:00Z', '2026-06-25T00:00:00Z')
  assert.equal(clusters.length, 1)
})

// events.cluster_id 关联
test('events.cluster_id 写入正确', () => {
  const event = db.prepare('SELECT cluster_id FROM events WHERE id = ?').get('test-1')
  // test-1 没有设 cluster_id，应为 null
  assert.equal(event.cluster_id, null)
})

test('findByCluster 查询', () => {
  const events = readModel.findByCluster('nonexistent')
  assert.equal(events.length, 0)
})

// feedback
test('feedbackRepository.store 写入反馈', () => {
  const changes = feedbackRepo.store({
    eventId: 'test-1',
    type: 'click',
    value: 1,
    source: 'web',
  })
  assert.equal(changes, 1)
})

test('feedback 表记录正确', () => {
  const rows = db.prepare('SELECT * FROM feedback WHERE event_id = ?').all('test-1')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].type, 'click')
  assert.equal(rows[0].value, 1)
  assert.equal(rows[0].source, 'web')
})

// weekly_reports (schema only, no repository needed for v4.4)
test('weekly_reports 表可写入', () => {
  const changes = db.prepare(`
    INSERT INTO weekly_reports (id, week_start, week_end, cluster_count, event_count, article_chars, script_chars, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('wr-001', '2026-06-20', '2026-06-26', 5, 20, 3000, 1500, '2026-06-26T09:00:00Z').changes
  assert.equal(changes, 1)
})

db.close()
try { unlinkSync(TEST_DB) } catch {}

console.log(`\n=== 结果: ${passed} 通过, ${failed} 失败 ===`)
if (failed > 0) process.exit(1)
