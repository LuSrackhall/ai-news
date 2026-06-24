/**
 * CurationProfile — 选题 InferenceProfile
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export function createCurationProfile(workspace = '.') {
  return {
    name: 'curation',
    model: 'sonnet',
    prompt: readFileSync(join(workspace, 'prompts', 'v1', 'curation.md'), 'utf-8'),
    schema: {
      type: 'object',
      properties: {
        selected_items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              url: { type: 'string' },
              importance: { type: 'string' },
              curation_note: { type: 'string' },
            },
            required: ['id', 'title', 'url', 'importance'],
          },
        },
        curation_summary: {
          type: 'object',
          properties: {
            total_selected: { type: 'number' },
            categories_covered: { type: 'array', items: { type: 'string' } },
            sources_used: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      required: ['selected_items', 'curation_summary'],
    },
    examples: [],
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
