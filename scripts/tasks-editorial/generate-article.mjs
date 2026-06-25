/**
 * GenerateArticle Task — LLM 文章生成
 */

import { ExecutionResult } from '../runtime/result.mjs'
import { computeHash } from '../engine/schemas.mjs'

export class GenerateArticle {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const curatedEvents = ctx._curatedEvents || []
    const eventsJson = JSON.stringify(curatedEvents, null, 2)

    const profile = ctx.scope.inference.getProfile('article')
    const editorialExamples = (profile?.examples || []).length > 0
      ? '\n\n## 优秀 Editorial 示例\n' + profile.examples.map(e =>
        `- 观察：${e.observation}\n  证据：${e.evidence}\n  判断：${e.judgment}\n  预测：${e.prediction}`
      ).join('\n')
      : ''

    const content = await ctx.scope.inference.run('article', {
      input_data: eventsJson.slice(0, 15000),
      editorial_examples: editorialExamples,
    })

    if (!content) return ExecutionResult.fatal('article_generation_failed')

    ctx._articleContent = content
    ctx._articleMeta = {
      eventIds: curatedEvents.map(e => e.id),
      model: 'sonnet',
      promptVersion: 'v1',
      inputHash: computeHash(eventsJson.slice(0, 15000)),
      retryCount: 0,
    }

    return ExecutionResult.ok({ article_ok: true }, { retry_count: 0 })
  }
}
