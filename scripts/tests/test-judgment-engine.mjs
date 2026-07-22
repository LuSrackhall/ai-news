/**
 * JudgmentEngine 单元测试
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'
import { JudgmentEngine, REJECTION_TYPE } from './judgment-engine.mjs'
import { ContentRelevanceRule } from './rules/content-relevance-rule.mjs'

// 辅助：创建测试事件
function makeEvent(id, overrides = {}) {
  return {
    id,
    title: overrides.title || 'Test Event',
    summary: overrides.summary || 'A test event about AI technology',
    rank: { totalScore: overrides.score ?? 60 },
    source: { name: overrides.source || 'test-source', tier: overrides.tier ?? 2 },
    source_name: overrides.source || 'test-source',
    category: overrides.category || 'ai',
    ...overrides,
  }
}

describe('JudgmentEngine', () => {
  it('should qualify events with default rules', () => {
    const engine = new JudgmentEngine()
    const result = engine.qualify([makeEvent('evt-1')])
    assert.strictEqual(result.qualified.length, 1)
    assert.strictEqual(result.rejected.length, 0)
  })

  it('should handle empty event list', () => {
    const engine = new JudgmentEngine()
    const result = engine.qualify([])
    assert.strictEqual(result.qualified.length, 0)
    assert.strictEqual(result.rejected.length, 0)
  })

  it('should reject non-AI content via ContentRelevanceRule', () => {
    const engine = new JudgmentEngine({
      qualificationRules: [new ContentRelevanceRule()],
    })
    const result = engine.qualify([
      makeEvent('evt-ai', { title: 'GPT-6 released by OpenAI' }),
      makeEvent('evt-nonai', { title: '某公司IPO上市过会', summary: 'IPO 申请通过审核' }),
    ])
    assert.strictEqual(result.qualified.length, 1)
    assert.strictEqual(result.rejected.length, 1)
    assert.strictEqual(result.rejected[0].type, 'hard')
  })

  it('should pass BREAKING events through qualification', () => {
    const engine = new JudgmentEngine()
    // Manually add a breaking signal via rule
    const result = engine.qualify([
      makeEvent('evt-breaking', { title: 'BREAKING: GPT-6 Released' }),
    ])
    assert.strictEqual(result.qualified.length, 1)
  })

  it('should prioritize events within budget', () => {
    const engine = new JudgmentEngine()
    const qualified = Array.from({ length: 10 }, (_, i) => ({
      event: makeEvent(`evt-${i}`, { score: 100 - i }),
      signals: [],
      priorityWeight: 0,
    }))
    const result = engine.prioritize(qualified, 3)
    assert.strictEqual(result.candidates.length, 3)
  })

  it('should throw on invalid budget', () => {
    const engine = new JudgmentEngine()
    const qualified = [{ event: makeEvent('evt-1'), signals: [], priorityWeight: 0 }]
    assert.throws(() => engine.prioritize(qualified, 0), /Budget/)
  })

  it('should sort by finalRank descending', () => {
    const engine = new JudgmentEngine()
    const qualified = [
      { event: makeEvent('evt-high', { score: 90 }), signals: [], priorityWeight: 0 },
      { event: makeEvent('evt-low', { score: 40 }), signals: [], priorityWeight: 0 },
      { event: makeEvent('evt-mid', { score: 60 }), signals: [], priorityWeight: 0 },
    ]
    const result = engine.prioritize(qualified, 10)
    assert.ok(result.candidates[0].event.id === 'evt-high')
    assert.ok(result.candidates[2].event.id === 'evt-low')
  })

  it('should collect metrics in evaluation mode', () => {
    const engine = new JudgmentEngine({
      qualificationRules: [new ContentRelevanceRule()],
      mode: 'evaluation',
    })
    engine.qualify([
      makeEvent('evt-1', { title: 'AI News' }),
      makeEvent('evt-2', { title: 'Leetcode每日一题' }),
    ])
    const m = engine.metrics
    assert.ok(m.totalInput >= 2)
  })

  it('should check production constraints', () => {
    const engine = new JudgmentEngine({ mode: 'evaluation' })
    // Simulate metrics
    engine._metrics = {
      totalInput: 100,
      qualifiedCount: 65,
      hardRejected: 10,
      contextualRejected: 25,
      prioritizedCount: 40,
      sourceDistribution: { '36kr': 70, 'other': 30 },
    }
    const result = engine.checkProductionConstraints({
      maxNonAiRatio: 0.05,
      maxSingleSourceRatio: 0.35,
    })
    assert.ok(!result.passed)
    assert.ok(result.violations.length > 0)
    assert.ok(result.violations.some(v => v.includes('non_ai_ratio')))
    assert.ok(result.violations.some(v => v.includes('single_source')))
  })

  it('should pass production constraints when metrics are clean', () => {
    const engine = new JudgmentEngine({ mode: 'evaluation' })
    engine._metrics = {
      totalInput: 100,
      qualifiedCount: 95,
      hardRejected: 3,
      contextualRejected: 2,
      prioritizedCount: 40,
      sourceDistribution: { 'source-a': 30, 'source-b': 25, 'source-c': 25, 'source-d': 20 },
    }
    const result = engine.checkProductionConstraints({
      maxNonAiRatio: 0.05,
      maxSingleSourceRatio: 0.35,
    })
    assert.ok(result.passed)
    assert.strictEqual(result.violations.length, 0)
  })

  it('should work without memory (cold start)', () => {
    const engine = new JudgmentEngine()
    const result = engine.qualify([
      makeEvent('evt-1'),
      makeEvent('evt-2'),
    ])
    assert.strictEqual(result.qualified.length, 2)
  })

  it('should reset metrics', () => {
    const engine = new JudgmentEngine({ mode: 'evaluation' })
    engine.qualify([makeEvent('evt-1')])
    assert.ok(engine.metrics.totalInput > 0)
    engine.resetMetrics()
    assert.strictEqual(engine.metrics.totalInput, 0)
  })
})
