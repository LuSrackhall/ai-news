/**
 * SqliteMemoryStore 单元测试
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'
import { SqliteMemoryStore, STORY_STATES, REJECTION_TYPES } from './memory-store.mjs'
import { join } from 'node:path'
import { unlinkSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'

function createTestStore() {
  const dbPath = join(tmpdir(), `test-editorial-memory-${Date.now()}.db`)
  return { store: new SqliteMemoryStore(dbPath), path: dbPath }
}

function cleanup(store, path) {
  store.close()
  try { if (existsSync(path)) unlinkSync(path) } catch { /* ignore */ }
}

describe('SqliteMemoryStore', () => {
  it('should initialize and be connected', () => {
    const { store, path } = createTestStore()
    assert.ok(store.connected)
    cleanup(store, path)
  })

  it('should track a story', () => {
    const { store, path } = createTestStore()
    const result = store.trackStory({
      storyKey: 'openai-gpt6',
      entity: 'OpenAI',
      title: 'GPT-6 Released',
      eventId: 'evt-001',
      date: '2026-07-04',
    })
    assert.ok(result.storyId !== null)
    assert.ok(result.isNew)
    cleanup(store, path)
  })

  it('should not create duplicate story on repeated track', () => {
    const { store, path } = createTestStore()
    store.trackStory({ storyKey: 'openai-gpt6', entity: 'OpenAI', title: 'GPT-6 Released', eventId: 'evt-001', date: '2026-07-04' })
    const result = store.trackStory({ storyKey: 'openai-gpt6', entity: 'OpenAI', title: 'GPT-6 Benchmark', eventId: 'evt-002', date: '2026-07-05' })
    assert.ok(result.storyId !== null)
    assert.ok(!result.isNew)
    cleanup(store, path)
  })

  it('should return timeline for a story', () => {
    const { store, path } = createTestStore()
    store.trackStory({ storyKey: 'deepseek-v4', entity: 'DeepSeek', eventId: 'evt-001', date: '2026-07-01' })
    store.trackStory({ storyKey: 'deepseek-v4', entity: 'DeepSeek', eventId: 'evt-002', date: '2026-07-03' })
    const result = store.queryStory('deepseek-v4')
    assert.ok(result !== null)
    assert.strictEqual(result.timeline.length, 2)
    cleanup(store, path)
  })

  it('should return null for unknown story', () => {
    const { store, path } = createTestStore()
    assert.strictEqual(store.queryStory('nonexistent'), null)
    cleanup(store, path)
  })

  it('should query stories by entity', () => {
    const { store, path } = createTestStore()
    store.trackStory({ storyKey: 'meta-llama', entity: 'Meta', eventId: 'evt-001', date: '2026-07-01' })
    store.trackStory({ storyKey: 'meta-fair', entity: 'Meta', eventId: 'evt-002', date: '2026-07-02' })
    const stories = store.queryStoriesByEntity('Meta')
    assert.strictEqual(stories.length, 2)
    cleanup(store, path)
  })

  it('should manage story lifecycle state', () => {
    const { store, path } = createTestStore()
    store.trackStory({ storyKey: 'anthropic-sonnet', entity: 'Anthropic', eventId: 'evt-001', date: '2026-07-01' })
    const updated = store.updateStoryLifecycle('anthropic-sonnet', STORY_STATES.PEAK)
    assert.ok(updated)
    const lifecycle = store.getStoryLifecycle('anthropic-sonnet')
    assert.strictEqual(lifecycle.state, 'peak')
    cleanup(store, path)
  })

  it('should return null lifecycle for unknown story', () => {
    const { store, path } = createTestStore()
    assert.strictEqual(store.getStoryLifecycle('unknown'), null)
    cleanup(store, path)
  })

  it('should log and retrieve rejected events', () => {
    const { store, path } = createTestStore()
    store.logRejectedEvent({
      eventId: 'evt-rej-001',
      eventTitle: 'Non-AI Content',
      reason: 'not_ai_related',
      rejectType: REJECTION_TYPES.HARD,
      sourceName: '36kr',
    })
    const history = store.getRejectionHistory('evt-rej-001')
    assert.strictEqual(history.length, 1)
    assert.strictEqual(history[0].reason, 'not_ai_related')
    cleanup(store, path)
  })

  it('should return empty rejection history for unknown event', () => {
    const { store, path } = createTestStore()
    assert.deepStrictEqual(store.getRejectionHistory('unknown'), [])
    cleanup(store, path)
  })

  it('should save and load day snapshots', () => {
    const { store, path } = createTestStore()
    store.saveDaySnapshot('2026-07-04', {
      topEventIds: ['evt-001', 'evt-002'],
      topEntities: ['OpenAI', 'DeepSeek'],
      topCategories: ['model_release', 'funding'],
    })
    const snapshots = store.loadDaySnapshots('2026-07-04')
    assert.strictEqual(snapshots.length, 1)
    assert.strictEqual(JSON.parse(snapshots[0].top_event_ids).length, 2)
    cleanup(store, path)
  })

  it('should cold-start with empty database', () => {
    const { store, path } = createTestStore()
    assert.strictEqual(store.queryStory('anything'), null)
    assert.deepStrictEqual(store.queryStoriesByEntity('anything'), [])
    assert.deepStrictEqual(store.getRejectionHistory('anything'), [])
    assert.strictEqual(store.getCoverageCount('anything'), 0)
    assert.deepStrictEqual(store.loadDaySnapshots('2026-07-01'), [])
    cleanup(store, path)
  })

  it('should handle close and reconnect gracefully', () => {
    const { store, path } = createTestStore()
    store.close()
    // After close, operations should not throw
    const story = store.queryStory('anything')
    assert.strictEqual(story, null)
    cleanup(store, path)
  })
})
