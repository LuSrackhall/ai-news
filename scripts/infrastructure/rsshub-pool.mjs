/**
 * RsshubPool — RSSHub 公共实例连接池 + 熔断器
 *
 * 三态熔断：CLOSED → OPEN → HALF-OPEN
 * 冷却时间：min(10min × 2^failures, 2h)
 * 健康状态持久化到 data/rsshub-health.json
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const COOLDOWN_BASE_MS = 10 * 60 * 1000   // 10 分钟
const COOLDOWN_MAX_MS = 2 * 60 * 60 * 1000 // 2 小时
const FAILURE_THRESHOLD = 3                 // 连续失败 N 次触发熔断
const HEALTH_FILE = join('data', 'rsshub-health.json')

export class RsshubPool {
  /**
   * @param {string[]} instances - 实例 URL 列表
   */
  constructor(instances) {
    this.instances = instances
    this.state = this._loadHealth()
    this._nextIndex = 0
  }

  /**
   * 获取一个可用实例 URL
   * 优先返回 CLOSED 实例，其次返回 HALF-OPEN（试探）
   * 全部不可用返回 null
   */
  getInstance() {
    const now = Date.now()

    // 第一轮：找 CLOSED 实例
    for (let i = 0; i < this.instances.length; i++) {
      const idx = (this._nextIndex + i) % this.instances.length
      const url = this.instances[idx]
      const s = this._getState(url)
      if (s.status === 'closed') {
        this._nextIndex = (idx + 1) % this.instances.length
        return url
      }
    }

    // 第二轮：找冷却已过期的实例（HALF-OPEN 试探）
    for (let i = 0; i < this.instances.length; i++) {
      const idx = (this._nextIndex + i) % this.instances.length
      const url = this.instances[idx]
      const s = this._getState(url)
      if (s.status === 'open' && s.cooldownUntil && s.cooldownUntil <= now) {
        s.status = 'half-open'
        this._nextIndex = (idx + 1) % this.instances.length
        return url
      }
    }

    return null
  }

  /**
   * 报告成功：重置失败计数，状态变为 CLOSED
   */
  reportSuccess(url) {
    const s = this._getState(url)
    s.status = 'closed'
    s.consecutiveFailures = 0
    s.cooldownUntil = null
    s.lastSuccess = new Date().toISOString()
    this._saveHealth()
  }

  /**
   * 报告失败：增加失败计数，达到阈值触发熔断
   */
  reportFailure(url) {
    const s = this._getState(url)
    s.consecutiveFailures++
    s.lastFailure = new Date().toISOString()

    if (s.consecutiveFailures >= FAILURE_THRESHOLD) {
      s.status = 'open'
      // 指数退避：10min × 2^(failures - threshold)，上限 2h
      const exp = s.consecutiveFailures - FAILURE_THRESHOLD
      const cooldown = Math.min(COOLDOWN_BASE_MS * Math.pow(2, exp), COOLDOWN_MAX_MS)
      s.cooldownUntil = Date.now() + cooldown
    }

    this._saveHealth()
  }

  // --- 内部方法 ---

  _getState(url) {
    if (!this.state[url]) {
      this.state[url] = {
        status: 'closed',
        consecutiveFailures: 0,
        cooldownUntil: null,
        lastSuccess: null,
        lastFailure: null,
      }
    }
    return this.state[url]
  }

  _loadHealth() {
    try {
      const data = readFileSync(HEALTH_FILE, 'utf-8')
      return JSON.parse(data)
    } catch {
      return {}
    }
  }

  _saveHealth() {
    try {
      mkdirSync('data', { recursive: true })
      writeFileSync(HEALTH_FILE, JSON.stringify(this.state, null, 2))
    } catch {
      // 写入失败不影响采集流程
    }
  }
}
