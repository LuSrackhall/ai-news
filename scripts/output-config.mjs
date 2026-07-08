/**
 * output-config.mjs — 输出目录配置
 *
 * 所有产出相关脚本从此文件读取路径，不硬编码。
 * 添加新领域时，在 DOMAINS 中添加配置。
 */

export const DOMAINS = {
  ai: {
    name: 'AI 领域日报',
    productionBase: 'output/production/ai',
    testBase: 'output/test/ai',
    baselinePath: 'output/baseline/ai/baseline.json',
  },
  // 后续领域在此扩展：
  // robotics: {
  //   name: '机器人领域周报',
  //   productionBase: 'output/production/robotics',
  //   testBase: 'output/test/robotics',
  // },
}

export const DEFAULT_DOMAIN = 'ai'

/**
 * 获取指定领域的输出路径
 * @param {string} [domain='ai'] — 领域名称
 * @param {'production'|'test'} [type='production'] — 类型
 * @returns {{ base: string, baseline: string }}
 */
export function getDomainPaths(domain = DEFAULT_DOMAIN, type = 'production') {
  const cfg = DOMAINS[domain]
  if (!cfg) throw new Error(`未知领域: ${domain}`)
  return {
    base: type === 'production' ? cfg.productionBase : cfg.testBase,
    baseline: cfg.baselinePath,
  }
}
