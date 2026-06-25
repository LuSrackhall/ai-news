/**
 * NodeHost — 纯 Node.js Host 实现
 * 不依赖 Claude Code Workflow 原语
 *
 * LLM 调用通过 ANTHROPIC_API_KEY 环境变量
 * 日志通过 console.log
 */

export function createNodeHost() {
  const metrics = []

  return {
    log(msg) {
      console.log(`[${new Date().toISOString()}] ${msg}`)
    },

    async invoke(prompt, opts = {}) {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY not set. Export it before running.')
      }

      const model = opts.model || 'claude-sonnet-4-20250514'
      const body = {
        model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }

      if (opts.schema) {
        body.tools = [{
          name: 'output',
          description: 'Output structured result',
          input_schema: opts.schema,
        }]
        body.tool_choice = { type: 'tool', name: 'output' }
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(`Anthropic API error: ${response.status} ${err}`)
      }

      const data = await response.json()

      // 提取结果
      if (opts.schema && data.content?.[0]?.type === 'tool_use') {
        return data.content[0].input
      }

      return data.content?.[0]?.text || ''
    },

    metric(key, value) {
      metrics.push({ key, value, at: new Date().toISOString() })
    },

    now() {
      return new Date().toISOString()
    },

    elapsed(startMs) {
      return Date.now() - startMs
    },
  }
}
