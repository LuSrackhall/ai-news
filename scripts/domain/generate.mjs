/**
 * Generate Domain — LLM 内容生成编排
 * 从 workflow Phase 5 代码提取
 * 返回 { content, meta } 结构
 */

import { computeHash } from '../engine/schemas.mjs'

export function createGenerateDomain(ctx) {
  const ARTICLE_SCHEMA = {
    type: 'object',
    properties: {
      hook: { type: 'string' },
      summary_items: { type: 'array', items: { type: 'object' } },
      editorial: { type: 'object' },
    },
    required: ['hook', 'summary_items', 'editorial'],
  }

  const SCRIPT_SCHEMA = {
    type: 'object',
    properties: {
      hook: { type: 'object' },
      overview: { type: 'object' },
      closing: { type: 'object' },
    },
    required: ['hook', 'overview', 'closing'],
  }

  return {
    /**
     * 生成文章 Artifact content
     * @returns {{ content: Object, meta: Object }}
     */
    async article() {
      const events = await ctx.stores.events.load()
      const curatedEvents = events.filter(e => e.curation)
      const eventsJson = JSON.stringify(curatedEvents, null, 2)

      const goodEditorials = ctx.services.prompt.loadExamples('good_editorials')
      const editorialExamples = goodEditorials.length > 0
        ? '\n\n## 优秀 Editorial 示例\n' + goodEditorials.map(e =>
          `- 观察：${e.observation}\n  证据：${e.evidence}\n  判断：${e.judgment}\n  预测：${e.prediction}`
        ).join('\n')
        : ''

      const prompt = ctx.services.prompt.load('prompts/v1/article.md', {
        input_data: eventsJson.slice(0, 15000),
        editorial_examples: editorialExamples,
      })

      const content = await ctx.services.agent.generate(prompt, ARTICLE_SCHEMA, {
        label: '文章生成',
        phase: 'LLM 生成',
        model: 'sonnet',
      })

      return {
        content,
        meta: {
          eventIds: curatedEvents.map(e => e.id),
          model: 'sonnet',
          promptVersion: ctx.environment.config.promptVersion,
          inputHash: computeHash(eventsJson.slice(0, 15000)),
          retryCount: content ? 0 : 1,
          generatedAt: ctx.environment.clock.now(),
        },
      }
    },

    /**
     * 生成口播稿 Artifact content
     * @param {Object} articleContent - 文章 content（用于注入 script prompt）
     * @returns {{ content: Object, meta: Object }}
     */
    async script(articleContent) {
      const events = await ctx.stores.events.load()
      const curatedEvents = events.filter(e => e.curation)
      const eventsJson = JSON.stringify(curatedEvents, null, 2)
      const articleJsonStr = JSON.stringify(articleContent, null, 2)

      const prompt = ctx.services.prompt.load('prompts/v1/script.md', {
        news_data: eventsJson.slice(0, 10000),
        article_data: articleJsonStr.slice(0, 8000),
      })

      const content = await ctx.services.agent.generate(prompt, SCRIPT_SCHEMA, {
        label: '口播稿生成',
        phase: 'LLM 生成',
        model: 'sonnet',
      })

      return {
        content,
        meta: {
          eventIds: curatedEvents.map(e => e.id),
          model: 'sonnet',
          promptVersion: ctx.environment.config.promptVersion,
          inputHash: computeHash(eventsJson.slice(0, 10000)),
          totalDurationS: computeDuration(content),
          generatedAt: ctx.environment.clock.now(),
        },
      }
    },
  }
}

function computeDuration(scriptContent) {
  if (!scriptContent) return 0
  const getDur = (s) => s?.durationS || s?.duration_s || 0
  return [
    getDur(scriptContent.hook),
    getDur(scriptContent.overview),
    ...(scriptContent.deepItems || scriptContent.deep_items || []).map(getDur),
    ...(scriptContent.quickItems || scriptContent.quick_items || []).map(getDur),
    getDur(scriptContent.closing),
  ].reduce((a, b) => a + b, 0)
}
