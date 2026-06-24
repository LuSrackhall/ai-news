/**
 * InferenceService — LLM 调用执行器
 * Profile 是配置，Service 是执行
 */

import { createArticleProfile } from './inference-profiles/article-profile.mjs'
import { createScriptProfile } from './inference-profiles/script-profile.mjs'
import { createCurationProfile } from './inference-profiles/curation-profile.mjs'

export function createInferenceService(host, workspace = '.') {
  const profiles = new Map()
  profiles.set('article', createArticleProfile(workspace))
  profiles.set('script', createScriptProfile(workspace))
  profiles.set('curation', createCurationProfile(workspace))

  function parseJsonFallback(text) {
    try { return JSON.parse(text) } catch {}
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try { return JSON.parse(text.slice(start, end + 1)) } catch {}
    }
    return null
  }

  return {
    async run(name, variables) {
      const profile = profiles.get(name)
      if (!profile) throw new Error(`Unknown profile: ${name}`)

      const prompt = profile.renderPrompt(variables)
      let result = await host.invoke(prompt, { model: profile.model, schema: profile.schema })

      // 直接是对象
      if (typeof result === 'object' && result !== null) return result

      // JSON 解析兜底
      const parsed = parseJsonFallback(String(result))
      if (parsed) return parsed

      // 重试
      if (profile.retry > 0) {
        const retryPrompt = prompt.length > 15000 ? prompt.slice(0, 15000) : prompt
        const retryResult = await host.invoke(retryPrompt, { model: profile.model, schema: profile.schema })
        if (typeof retryResult === 'object' && retryResult !== null) return retryResult
        return parseJsonFallback(String(retryResult))
      }

      return null
    },

    getProfile(name) { return profiles.get(name) },
  }
}
