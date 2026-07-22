/**
 * JudgmentEngine + MemoryStore 集成测试
 *
 * 测试完整链路：Qualification → Prioritization → Memory interaction
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { join } from 'node:path'
import { unlinkSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'

import { SqliteMemoryStore } from './memory-store.mjs'
import { JudgmentEngine } from './judgment-engine.mjs'
import { ContentRelevanceRule } from './rules/content-relevance-rule.mjs'

function makeEvent(id, overrides = {}) {
  return {
    id,
    title: overrides.title || 'Test AI Event',
    summary: overrides.summary || 'A technology event about artificial intelligence',
    rank: { totalScore: overrides.score ?? 60 },
    source: { name: overrides.source || 'tech-source', tier: overrides.tier ?? 2 },
    source_name: overrides.source || 'tech-source',
    source_tier: overrides.tier ?? 2,
    ...overrides,
  }
}

describe('JudgmentEngine + MemoryStore Integration', () => {
  let dbPath, store, engine

  before(() => {
    dbPath = join(tmpdir(), `test-editorial-int-${Date.now()}.db`)
    store = new SqliteMemoryStore(dbPath)
    engine = new JudgmentEngine({
      qualificationRules: [new ContentRelevanceRule()],
      memory: store,
      mode: 'evaluation',
    })
  })

  after(() => {
    store.close()
    try { if (existsSync(dbPath)) unlinkSync(dbPath) } catch { /* ignore */ }
  })

  it('should qualify and prioritize events in sequence', () => {
    const events = [
      makeEvent('ai-1', { title: 'GPT-6 Performance Benchmarks Released', source: 'techcrunch' }),
      makeEvent('ai-2', { title: 'Anthropic Announces Claude 5', source: 'techcrunch' }),
      makeEvent('ai-3', { title: 'DeepSeek Open-Sources New Reasoning Model', source: '36kr' }),
    ]

    // Phase 1: Qualification
    const { qualified, rejected } = engine.qualify(events)
    assert.strictEqual(qualified.length, 3, 'all AI events should be qualified')
    assert.strictEqual(rejected.length, 0, 'no rejections expected')

    // Phase 2: Prioritization
    const result = engine.prioritize(qualified, 2)
    assert.strictEqual(result.candidates.length, 2, 'budget 2 should produce 2 candidates')
    assert.ok(result.candidates[0].finalRank >= result.candidates[1].finalRank, 'should be sorted descending')
  })

  it('should reject non-AI content and record to memory', () => {
    const events = [
      makeEvent('business-1', { title: 'IPO 上市过会', summary: '某公司 IPO 申请通过审核', source: '36kr' }),
      makeEvent('ai-1', { title: 'OpenAI Releases GPT-6', source: 'techcrunch' }),
    ]

    const { qualified, rejected } = engine.qualify(events)
    assert.strictEqual(qualified.length, 1, 'only AI event should pass')
    assert.strictEqual(rejected.length, 1, 'non-AI event should be rejected')
    assert.strictEqual(rejected[0].type, 'hard', 'should be hard rejection')

    // Memory should have recorded the rejection
    const history = store.getRejectionHistory(rejected[0].event.id)
    assert.ok(history.length >= 1, 'rejection should be logged to memory')
  })

  it('should handle memory unavailable (cold start)', () => {
    const engineNoMem = new JudgmentEngine({
      qualificationRules: [new ContentRelevanceRule()],
      memory: null,
    })
    const events = [
      makeEvent('cold-1', { title: 'New AI Model Released' }),
      makeEvent('cold-2', { title: 'Leetcode 每日一题', summary: '' }),
    ]
    const { qualified, rejected } = engineNoMem.qualify(events)
    assert.strictEqual(qualified.length, 1, 'cold start should work without memory')
    assert.strictEqual(rejected.length, 1, 'non-AI should still be rejected')
  })

  it('should record evaluation metrics', () => {
    const engine = new JudgmentEngine({
      qualificationRules: [new ContentRelevanceRule()],
      mode: 'evaluation',
    })
    engine.qualify([
      makeEvent('evt-1', { title: 'AI News', source: 'source-a' }),
      makeEvent('evt-2', { title: 'AI Research Paper', source: 'source-b' }),
      makeEvent('evt-3', { title: 'Entertainment News', summary: '影视排行榜' }),
    ])

    const m = engine.metrics
    assert.ok(m.totalInput >= 3, 'should count total input')
    assert.ok(m.hardRejected >= 1, 'should count rejections')
  })

  it('should track stories via memory integration', () => {
    // Track a story that's been seen before
    store.trackStory({
      storyKey: 'openai-gpt',
      entity: 'OpenAI',
      eventId: 'prev-1',
      date: '2026-07-03',
    })

    const events = [
      makeEvent('current-1', { title: 'OpenAI GPT-6 Day 2', entities: ['OpenAI'] }),
    ]

    // Query memory during judgment
    const story = store.queryStory('openai-gpt')
    assert.ok(story, 'story should be retrievable')
    assert.strictEqual(story.story.entity, 'OpenAI')
  })

  it('should check production constraints', () => {
    const engine = new JudgmentEngine({ mode: 'evaluation' })
    engine.qualify([
      makeEvent('a', { source: '36kr' }),
      makeEvent('b', { source: '36kr' }),
      makeEvent('c', { source: '36kr' }),
    ])

    // Manually set skewed metrics for demonstration
    engine._metrics.sourceDistribution = { '36kr': 40, 'other': 10 }
    engine._metrics.hardRejected = 3
    engine._metrics.qualifiedCount = 47
    engine._metrics.totalInput = 50

    const check = engine.checkProductionConstraints({
      maxNonAiRatio: 0.05,
      maxSingleSourceRatio: 0.35,
    })
    // With 36kr having 40/50 = 80%, this should violate
    assert.ok(check.violations.some(v => v.includes('single_source')), 'should flag source diversity violation')
  })
})
