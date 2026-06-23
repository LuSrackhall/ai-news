/**
 * v4 数据模型 Schema 定义
 * Asset / Event / Artifact — 纯文档，含字段类型注释和 contentHash 计算规则
 *
 * 这不是运行时校验代码，而是类型契约的单一真相源。
 * 各 Store / Domain 按此结构组织数据。
 */

import { createHash } from 'node:crypto'

// ── Asset Schema ──
// {
//   id:             string          // 唯一 ID（源内唯一）
//   type:           'rss'|'web'|'paper'|'tweet'|'release'|'blog'
//   title:          string
//   url:            string
//   summary:        string          // v3 的 summary_zh
//   content:        string|null     // 全文（v4.0 暂为空）
//   source:         { name: string, tier: 1|2|3, url: string|null }
//   publishedAt:    ISO timestamp
//   fetchedAt:      ISO timestamp
//   verifiedAt:     ISO timestamp|null
//   contentHash:    string          // sha256(title + url + summary + publishedAt)
//   category:       string|null
//   language:       'zh'|'en'|'mixed'
//   metadata: {
//     impactScore:  number,
//     urlVerified:  boolean,
//     deadLink:     boolean,
//     dateFromHtml: boolean,
//   }
// }

// ── Event Schema ──
// {
//   id:             string          // v4.0 = asset.id
//   type:           'news'|'announcement'|'release'|'research'|'opinion'
//   title:          string
//   summary:        string
//   url:            string|null     // v4.0 = asset.url, v4.1 聚类后可能 null
//   sources:        [{ name, tier, url, publishedAt }]  // v4.0 始终 1 个
//   assetIds:       string[]        // v4.0 = [asset.id]
//   clusterId:      string|null     // v4.0 = null
//   contentHash:    string          // v4.0 继承 Asset 的 contentHash
//   rank:           { baseScore, bonusScore, totalScore, tierLabel, factors } | null
//   curation:       { importance: 'deep'|'important'|'brief', note: string|null } | null
//   entities:       string[]        // v4.0 = []
//   topics:         string[]        // v4.0 = []
//   relatedEventIds: string[]
//   timeline:       { collected, verified, curated, generated }  // ISO timestamps
//   metadata:       object
// }

// ── ArticleArtifact Schema ──
// {
//   type:     'article'
//   content:  { hook, summaryItems, deepItems, importantItems, briefItems, editorial }
//   rendered: { markdown, html } | null
//   meta:     { generatedAt, model, promptVersion, eventIds, inputHash, retryCount }
// }

// ── ScriptArtifact Schema ──
// {
//   type:     'script'
//   content:  { hook: {text,durationS}, overview, closing, deepItems, quickItems }
//   rendered: { markdown, subtitles } | null
//   meta:     { generatedAt, model, promptVersion, eventIds, inputHash, totalDurationS }
// }

/**
 * 计算 Asset 的 contentHash
 * 规则：sha256(title + url + summary + publishedAt)
 */
export function computeAssetHash(asset) {
  const input = `${asset.title}|${asset.url}|${asset.summary}|${asset.publishedAt}`
  return 'sha256:' + createHash('sha256').update(input).digest('hex').slice(0, 16)
}

/**
 * 计算通用 contentHash（用于事件、产出等）
 */
export function computeHash(data) {
  const input = typeof data === 'string' ? data : JSON.stringify(data)
  return 'sha256:' + createHash('sha256').update(input).digest('hex').slice(0, 16)
}
