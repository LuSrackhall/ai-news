/**
 * Logger Service — 封装 Claude Code 的 log() 原语
 */

export function createLoggerService(runtime) {
  return {
    info(msg) { runtime.log(msg) },
    warn(msg) { runtime.log(`⚠️ ${msg}`) },
    error(msg) { runtime.log(`❌ ${msg}`) },
  }
}
