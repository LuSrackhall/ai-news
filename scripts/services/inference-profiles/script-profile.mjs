/**
 * ScriptProfile — 口播稿生成 InferenceProfile
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export function createScriptProfile(workspace = '.') {
  return {
    name: 'script',
    model: 'sonnet',
    prompt: readFileSync(join(workspace, 'prompts', 'v1', 'script.md'), 'utf-8'),
    schema: {
      type: 'object',
      properties: {
        hook: { type: 'object' },
        overview: { type: 'object' },
        closing: { type: 'object' },
      },
      required: ['hook', 'overview', 'closing'],
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
