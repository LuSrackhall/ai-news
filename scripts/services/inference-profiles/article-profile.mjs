/**
 * ArticleProfile — 文章生成 InferenceProfile
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export function createArticleProfile(workspace = '.') {
  return {
    name: 'article',
    model: 'sonnet',
    prompt: readFileSync(join(workspace, 'prompts', 'v1', 'article.md'), 'utf-8'),
    schema: {
      type: 'object',
      properties: {
        hook: { type: 'string' },
        summary_items: { type: 'array', items: { type: 'object' } },
        deep_items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              image: { type: 'string' },
              image_caption: { type: 'string' },
            },
          },
        },
        important_items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              image: { type: 'string' },
            },
          },
        },
        brief_items: { type: 'array', items: { type: 'object' } },
        editorial: { type: 'object' },
      },
      required: ['hook', 'summary_items', 'editorial'],
    },
    examples: loadExamples(workspace, 'good_editorials'),
    retry: 1,
    renderPrompt(vars) {
      let text = this.prompt
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v)
      }
      return text
    },
  }
}

function loadExamples(workspace, name) {
  try {
    return JSON.parse(readFileSync(join(workspace, 'prompts', 'examples', `${name}.json`), 'utf-8'))
  } catch {
    return []
  }
}
