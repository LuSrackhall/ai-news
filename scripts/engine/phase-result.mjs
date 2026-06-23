/**
 * PhaseResult — 标准化的 Phase 执行结果
 * 参考 CI Pipeline 惯例（GitHub Actions / GitLab CI / Airflow）
 */

export class PhaseResult {
  constructor({ status, inputs = null, outputs = null, metrics = null, artifacts = [], warnings = [], errors = [], duration = null, hash = null, cacheHit = null, replayed = null }) {
    this.status = status
    this.inputs = inputs
    this.outputs = outputs
    this.metrics = metrics
    this.artifacts = artifacts
    this.warnings = warnings
    this.errors = errors
    this.duration = duration
    this.hash = hash
    this.cacheHit = cacheHit
    this.replayed = replayed
  }

  static ok(metrics = {}) {
    return new PhaseResult({ status: 'ok', metrics })
  }

  static fatal(reason) {
    return new PhaseResult({ status: 'fatal', errors: [reason] })
  }

  static warn(metrics = {}, reason = null) {
    const result = new PhaseResult({ status: 'warn', metrics })
    if (reason) result.warnings.push(reason)
    return result
  }

  static skipped(reason = null) {
    return new PhaseResult({ status: 'skipped', warnings: reason ? [reason] : [] })
  }

  get reason() {
    return this.errors.length > 0 ? this.errors[0] : null
  }
}
