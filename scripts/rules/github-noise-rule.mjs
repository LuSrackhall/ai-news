/**
 * GitHubNoiseRule — GitHub/Atom 源噪音过滤
 * 正则匹配 URL 和标题，拦截 commit/issue/PR 噪音
 */

import { GITHUB_NOISE_RULES } from '../config.mjs'

export class GitHubNoiseRule {
  constructor() {
    this.config = GITHUB_NOISE_RULES
  }

  /**
   * 判断事件是否为 GitHub/Atom 源
   */
  isGitHubSource(sourceId) {
    return sourceId?.includes('github') || sourceId?.includes('atom')
  }

  /**
   * 过滤事件列表，返回 { passed, quarantined }
   * @param {Array} events - 事件列表
   * @returns {{ passed: Array, quarantined: Array }}
   */
  filter(events) {
    if (!this.config.enabled) {
      return { passed: events, quarantined: [] }
    }

    const passed = []
    const quarantined = []

    for (const event of events) {
      if (!this.isGitHubSource(event.sourceId)) {
        passed.push(event)
        continue
      }

      const reason = this.getDropReason(event)
      if (reason) {
        quarantined.push({ event, reason })
      } else {
        passed.push(event)
      }
    }

    return { passed, quarantined }
  }

  /**
   * 返回丢弃原因，null 表示不丢弃
   */
  getDropReason(event) {
    const url = event.url || ''
    const title = event.title || ''

    // 1. URL 路径匹配 — 直接丢弃
    for (const pattern of this.config.dropUrlPatterns) {
      if (pattern.test(url)) {
        return `url_match: ${pattern.source}`
      }
    }

    // 2. 标题匹配保留规则 — 优先保留
    for (const pattern of this.config.keepTitlePatterns) {
      if (pattern.test(title)) {
        return null
      }
    }

    // 3. 标题匹配丢弃规则
    for (const pattern of this.config.dropTitlePatterns) {
      if (pattern.test(title)) {
        return `title_match: ${pattern.source}`
      }
    }

    return null
  }

  /**
   * 获取隔离过期时间
   */
  getExpiresAt() {
    const days = this.config.quarantineDays || 3
    return new Date(Date.now() + days * 86400000).toISOString()
  }
}
