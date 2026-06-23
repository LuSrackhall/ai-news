/**
 * ExecutionStore — PipelineRun 持久化
 * v4.0 实现：JSON 文件（output/<date>/execution.json）
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export function createExecutionStore(environment) {
  function getPath() {
    return join(environment.workspace, environment.config.outputDir, environment.date, 'execution.json')
  }

  return {
    save(pipelineRun) {
      const path = getPath()
      mkdirSync(join(path, '..'), { recursive: true })
      writeFileSync(path, JSON.stringify(pipelineRun, null, 2))
    },
  }
}
