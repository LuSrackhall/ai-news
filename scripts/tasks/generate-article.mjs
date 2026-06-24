/**
 * GenerateArticle Task — 文章生成
 * readModel.load → inferenceService.run('article') → artifactRepository.store
 */

import { ExecutionResult } from '../runtime/result.mjs'
import { createHash } from 'node:crypto'

export class GenerateArticle {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const events = ctx.scope.events.readModel.load()
    const curatedEvents = events.filter(e => e.curation)
    const eventsJson = JSON.stringify(curatedEvents, null, 2)

    const profile = ctx.scope.inference.getProfile('article')
    const editorialExamples = (profile.examples || []).length > 0
      ? '\n\n## 优秀 Editorial 示例\n' + profile.examples.map(e =>
        `- 观察：${e.observation}\n  证据：${e.evidence}\n  判断：${e.judgment}\n  预测：${e.prediction}`
      ).join('\n')
      : ''

    const content = await ctx.scope.inference.run('article', {
      input_data: eventsJson.slice(0, 15000),
      editorial_examples: editorialExamples,
    })

    if (!content) return ExecutionResult.fatal('article_generation_failed')

    const inputHash = 'sha256:' + createHash('sha256').update(eventsJson.slice(0, 15000)).digest('hex').slice(0, 16)

    ctx.scope.artifacts.repository.store('article', {
      type: 'article',
      content,
      rendered: null,
      meta: {
        generatedAt: new Date().toISOString(),
        model: 'sonnet',
        promptVersion: 'v1',
        eventIds: curatedEvents.map(e => e.id),
        inputHash,
        retryCount: 0,
      },
    })

    return ExecutionResult.ok({ article_ok: true }, { retry_count: 0 })
  }
}
