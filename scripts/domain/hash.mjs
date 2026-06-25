/**
 * 哈希工具
 */

import { createHash } from 'node:crypto'

export function computeAssetHash(asset) {
  const input = `${asset.title || ''}|${asset.url || ''}|${asset.summary || ''}|${asset.publishedAt || ''}`
  return 'sha256:' + createHash('sha256').update(input).digest('hex').slice(0, 16)
}

export function computeHash(data) {
  const input = typeof data === 'string' ? data : JSON.stringify(data)
  return 'sha256:' + createHash('sha256').update(input).digest('hex').slice(0, 16)
}
