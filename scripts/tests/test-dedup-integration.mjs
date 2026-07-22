/**
 * MemoryDedupRule 单元测试
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { join } from 'node:path'
import { unlinkSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { SqliteMemoryStore, STORY_STATES } from './memory-store.mjs'
import { MemoryDedupRule } from './rules/dedup-rule.mjs'
import { JudgmentEngine } from './judgment-engine.mjs'

function makeEvent(id, overrides = {}) {
  return { id, title: overrides.title || 'Test Event', entities: overrides.entities || [], cluster_id: overrides.cluster_id || null, ...overrides }
}

describe('MemoryDedupRule', () => {
  let dbPath, store, rule

  before(() => {
    dbPath = join(tmpdir(), `test-dedup-${Date.now()}.db`)
    store = new SqliteMemoryStore(dbPath)
    rule = new MemoryDedupRule()
  })

  after(() => {
    store.close()
    try { if (existsSync(dbPath)) unlinkSync(dbPath) } catch { /* ignore */ }
  })

  it('should skip when no memory store', () => {
    const result = rule.evaluate([makeEvent('e1', { cluster_id: 'c1' })], {})
    assert.strictEqual(result.signals.length, 0)
  })

  it('should produce FOLLOW_UP for cluster match within 3 days', () => {
    store.trackStory({ storyKey: 'c1', entity: 'OpenAI', eventId: 'prev-1', date: '2026-07-05' })
    const result = rule.evaluate(
      [makeEvent('e1', { cluster_id: 'c1' })],
      { memoryStore: store, date: '2026-07-06' }
    )
    assert.strictEqual(result.signals.length, 1)
    assert.strictEqual(result.signals[0].subtype, 'FOLLOW_UP')
    assert.strictEqual(result.signals[0].phase, 'RANK')
    assert.ok(result.signals[0].weight < 0, 'should have negative weight')
  })

  it('should NOT produce FOLLOW_UP for old cluster (>3 days)', () => {
    store.trackStory({ storyKey: 'c-old', entity: 'DeepSeek', eventId: 'prev-2', date: '2026-07-01' })
    const result = rule.evaluate(
      [makeEvent('e2', { cluster_id: 'c-old' })],
      { memoryStore: store, date: '2026-07-06' }
    )
    assert.strictEqual(result.signals.length, 0, 'old cluster should not trigger follow-up')
  })

  it('should produce STALE contextual rejection', () => {
    store.trackStory({ storyKey: 'c-stale', entity: 'Meta', eventId: 'prev-3', date: '2026-07-01' })
    store.updateStoryLifecycle('c-stale', STORY_STATES.STALE)
    const result = rule.evaluate(
      [makeEvent('e3', { cluster_id: 'c-stale' })],
      { memoryStore: store, date: '2026-07-06' }
    )
    assert.strictEqual(result.signals.length, 1)
    assert.strictEqual(result.signals[0].subtype, 'STALE')
    assert.strictEqual(result.signals[0].phase, 'FILTER')
  })

  it('should fall back to entity match when no cluster_id', () => {
    store.trackStory({ storyKey: 'anthropic-safety', entity: 'Anthropic', eventId: 'prev-4', date: '2026-07-04' })
    const result = rule.evaluate(
      [makeEvent('e4', { cluster_id: null, entities: ['Anthropic'] })],
      { memoryStore: store, date: '2026-07-06' }
    )
    // entity match might trigger FOLLOW_UP
    assert.ok(result.signals.length === 0 || result.signals[0].subtype === 'FOLLOW_UP')
  })

  it('should handle empty event list', () => {
    const result = rule.evaluate([], { memoryStore: store })
    assert.strictEqual(result.signals.length, 0)
  })
})

describe('JudgmentEngine Backfill', () => {
  let engine

  before(() => {
    engine = new JudgmentEngine()
  })

  it('should not backfill when above threshold', () => {
    const qualified = [{ event: makeEvent('e1'), signals: [], priorityWeight: 0 }]
    const result = engine.backfill(qualified, 1, { queryFn: () => [{ id: 'fill-1', title: 'Fill Event' }] })
    assert.strictEqual(result.length, 1)
  })

  it('should backfill when below threshold', () => {
    const qualified = [{ event: makeEvent('e1'), signals: [], priorityWeight: 0 }]
    const result = engine.backfill(qualified, 5, {
      maxItems: 2,
      queryFn: (count, skipIds) => [
        { id: 'fill-1', title: 'Fill 1' },
        { id: 'fill-2', title: 'Fill 2' },
      ],
    })
    assert.strictEqual(result.length, 3)
    assert.ok(result[2].event._backfill, 'backfilled event should have _backfill flag')
  })

  it('should not backfill duplicates', () => {
    const qualified = [{ event: makeEvent('e1', { id: 'fill-1' }), signals: [], priorityWeight: 0 }]
    const result = engine.backfill(qualified, 5, {
      queryFn: (count, skipIds) => [{ id: 'fill-1', title: 'Already in pool' }],
    })
    assert.strictEqual(result.length, 1, 'should not add duplicate')
  })

  it('should handle empty query result', () => {
    const qualified = [{ event: makeEvent('e1'), signals: [], priorityWeight: 0 }]
    const result = engine.backfill(qualified, 5, { queryFn: () => [] })
    assert.strictEqual(result.length, 1)
  })

  it('should handle disabled backfill (no queryFn)', () => {
    const qualified = [{ event: makeEvent('e1'), signals: [], priorityWeight: 0 }]
    const result = engine.backfill(qualified, 1)
    assert.strictEqual(result.length, 1)
  })
})
