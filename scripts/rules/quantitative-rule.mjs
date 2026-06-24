/**
 * QuantitativeRule — 量化信号评分（Bonus）
 * 数字信号 → bonus score
 */

export class QuantitativeRule {
  name = 'quantitative'

  evaluate(asset) {
    const text = `${asset.title || ''} ${asset.description || ''} ${asset.summary || ''}`
    let score = 0
    if (/\$[\d.]+\s*[bBmM]/.test(text) || /[\d.]+\s*亿/.test(text)) score += 2
    if (/[\d.]+\s*%/.test(text) || /\d+x\s*faster/i.test(text)) score += 1
    if (/\d+\s*(billion|million|百万|千万)/i.test(text)) score += 1
    return { type: 'bonus', score: Math.min(score, 6) }
  }
}
