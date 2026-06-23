/**
 * Prompt Service — 从 v3 workflow 的 loadPrompt / loadExamples 迁移
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export function createPromptService(environment) {
  const baseDir = environment.workspace

  return {
    /**
     * 加载 prompt 模板并替换变量
     * @param {string} templatePath - 模板路径（相对 workspace）
     * @param {Object} vars - 变量键值对
     * @returns {string}
     */
    load(templatePath, vars = {}) {
      let template = readFileSync(join(baseDir, templatePath), 'utf-8')
      for (const [key, value] of Object.entries(vars)) {
        template = template.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
      }
      return template
    },

    /**
     * 加载 few-shot 示例
     * @param {string} name - 示例文件名（不含 .json）
     * @returns {Array}
     */
    loadExamples(name) {
      try {
        return JSON.parse(readFileSync(join(baseDir, 'prompts', 'examples', `${name}.json`), 'utf-8'))
      } catch {
        return []
      }
    },
  }
}
