/**
 * ExecutionResult — 统一执行结果
 * Runtime 的返回值和各 Task 的返回值使用同一结构
 */

export class ExecutionResult {
  constructor({ stepName = null, status, outputs = null, metrics = null, errors = [], duration = null }) {
    this.stepName = stepName
    this.status = status
    this.outputs = outputs
    this.metrics = metrics
    this.errors = errors
    this.duration = duration
  }

  static ok(outputs = {}, metrics = {}) {
    return new ExecutionResult({ status: 'ok', outputs, metrics })
  }

  static fatal(reason) {
    return new ExecutionResult({ status: 'fatal', errors: [reason] })
  }

  static warn(outputs = {}, metrics = {}) {
    return new ExecutionResult({ status: 'warn', outputs, metrics })
  }

  static skipped(reason = null) {
    return new ExecutionResult({ status: 'skipped', errors: reason ? [reason] : [] })
  }

  get reason() {
    return this.errors.length > 0 ? this.errors[0] : null
  }
}
