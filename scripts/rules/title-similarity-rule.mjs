/**
 * TitleSimilarityRule — 标题 bigram 相似度
 * 相似度 ≥ 0.5 判定重复
 */

export class TitleSimilarityRule {
  name = 'titleSimilarity'

  evaluate({ titleA, titleB }) {
    const sim = this.computeSimilarity(titleA, titleB)
    return { duplicate: sim >= 0.5, similarity: sim }
  }

  computeSimilarity(titleA, titleB) {
    const kwA = this.extractKeywords(titleA)
    const kwB = this.extractKeywords(titleB)
    if (kwA.size === 0 || kwB.size === 0) return 0
    const intersection = new Set([...kwA].filter((x) => kwB.has(x)))
    return intersection.size / Math.min(kwA.size, kwB.size)
  }

  extractKeywords(title) {
    const t = (title || '').replace(/[\s\-_|·：:，,。.！!？?""''「」【】《》()（）]/g, '')
    const enWords = (t.match(/[a-zA-Z][a-zA-Z0-9.]+/g) || []).map((w) => w.toLowerCase())
    const zhChars = t.replace(/[^一-鿿]/g, '')
    const zhBigrams = []
    for (let i = 0; i < zhChars.length - 1; i++) zhBigrams.push(zhChars.slice(i, i + 2))
    return new Set([...enWords, ...zhBigrams])
  }
}
