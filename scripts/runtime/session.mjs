/**
 * ExecutionSession — 执行会话（状态记录）
 * Runtime 负责执行，Session 负责记录
 */

export class ExecutionSession {
  constructor({ runId, resources }) {
    this.runId = runId
    this.startedAt = new Date().toISOString()
    this.finishedAt = null
    this.status = 'running'
    this.stepResults = []
    this.resources = resources
  }

  addResult(stepName, result) {
    this.stepResults.push({ step: stepName, ...result })
  }

  finish(status) {
    this.status = status
    this.finishedAt = new Date().toISOString()
  }

  toResult() {
    return {
      status: this.status,
      runId: this.runId,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      stepResults: this.stepResults,
      duration: this.finishedAt
        ? new Date(this.finishedAt).getTime() - new Date(this.startedAt).getTime()
        : null,
    }
  }
}
