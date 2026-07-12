/**
 * render-article.mjs — 标准化日报渲染器
 *
 * 用法: node scripts/render-article.mjs <date>
 * 例:   node scripts/render-article.mjs 2026-07-08
 *
 * 将 output/<date>/article.json 标准化渲染为 article.md
 * 格式规范见 docs/guides/article-format.md
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'

export function renderArticle(article, { sources, curatedCount } = {}) {
  const lines = []
  lines.push('# AI 日报 — ' + (article.date || ''))
  lines.push('')
  if (article.hook) { lines.push('> ' + article.hook); lines.push('') }

  // ─── 速览（无来源链接） ───
  lines.push('## 速览'); lines.push('')
  const sum = article.summary_items || []
  for (const item of sum) {
    if (item.title) { lines.push('### ' + item.title); lines.push('') }
    if (item.summary) { lines.push(item.summary); lines.push('') }
  }
  if (sum.length === 0) { lines.push('*内容更新中*'); lines.push('') }

  // ─── 深度 ───
  const deep = article.deep_items || []
  if (deep.length > 0) {
    lines.push('## 深度'); lines.push('')
    for (const item of deep) {
      lines.push('### ' + item.title); lines.push('')
      if (item.image) {
        lines.push('![' + (item.image_caption || item.title) + '](' + item.image + ')'); lines.push('')
        if (item.image_caption) { lines.push('*' + item.image_caption + '*'); lines.push('') }
      }
      // 证据截图
      if (item.evidence) {
        for (const ev of item.evidence) {
          if (ev.path) { lines.push('![' + (ev.caption || item.title) + '](' + ev.path + ')'); lines.push('') }
        }
      }
      if (item.content) { lines.push(item.content); lines.push('') }
      const ss = item.sources || []
      if (ss.length > 0) {
        lines.push('*来源：' + ss.map(s => '[' + s.name + '](' + s.url + ')').join('、') + '*'); lines.push('')
      }
    }
  }

  // ─── 重要动态 ───
  const imp = article.important_items || []
  if (imp.length > 0) {
    lines.push('## 重要动态'); lines.push('')
    for (const item of imp) {
      lines.push('### ' + item.title); lines.push('')
      if (item.image) {
        lines.push('![' + item.title + '](' + item.image + ')'); lines.push('')
      }
      if (item.evidence) {
        for (const ev of item.evidence) { if (ev.path) { lines.push('![' + (ev.caption || item.title) + '](' + ev.path + ')'); lines.push('') } }
      }
      if (item.summary) lines.push(item.summary)
      lines.push('')
      if (item.source) {
        lines.push('*来源：[' + item.source.name + '](' + item.source.url + ')*'); lines.push('')
      }
    }
  }

  // ─── 快讯 ───
  const brief = article.brief_items || []
  if (brief.length > 0) {
    lines.push('## 快讯'); lines.push('')
    for (const item of brief) {
      lines.push('**' + item.title + '**'); lines.push('')
      if (item.summary) { lines.push(item.summary); lines.push('') }
      const ss = item.sources || []
      if (ss.length > 0) {
        lines.push('*来源：' + ss.map(s => '[' + s.name + '](' + s.url + ')').join('、') + '*'); lines.push('')
      }
    }
  }

  // ─── 编辑观点（三段式） ───
  const ed = article.editorial || {}
  lines.push('---'); lines.push('')
  if (ed.observation || ed.evidence || ed.judgment) {
    lines.push('**编辑观察：** ' + (ed.observation || '')); lines.push('')
    if (ed.evidence) { lines.push('**证据：** ' + ed.evidence); lines.push('') }
    if (ed.judgment) { lines.push('**判断：** ' + ed.judgment); lines.push('') }
  }
  if (sources && sources.length > 0) {
    lines.push('*数据来源：' + sources.join('、') + ' | AI 辅助生成，经审核*')
  }
  return lines.join('\n')
}

// CLI
const date = process.argv[2]
  const baseDir = process.argv[3] || process.env.OUTPUT_DIR || "output/production/ai"
if (date) {
  try {
    const article = JSON.parse(readFileSync(baseDir + '/' + date + '/article.json', 'utf-8'))

    // 从 evidence/ 目录注入证据截图到 article items
    const evBase = baseDir + '/' + date + '/evidence'
    if (existsSync(evBase)) {
      const evDirs = readdirSync(evBase).filter(d =>
        existsSync(evBase + '/' + d + '/evidence.json')
      )
      // 构建 URL → evidence 目录的映射（用于后续匹配）
      const urlToEvDir = {}
      const idToEvDir = {}
      for (const d of evDirs) {
        idToEvDir[d] = d
        try {
          const meta = JSON.parse(readFileSync(evBase + '/' + d + '/evidence.json', 'utf-8'))
          if (meta?.source?.url) urlToEvDir[meta.source.url] = d
        } catch {}
      }

      const injectEvidence = (items) => {
        if (!items) return
        for (const item of items) {
          // 先按 item.id 匹配
          let evId = idToEvDir[item.id || ''] ? item.id : null
          // 未命中则按 URL 匹配（取 item 的第一个 source URL）
          if (!evId) {
            const urls = [item.url, item.source?.url, ...(item.sources || []).map(s => s.url)].filter(Boolean)
            for (const u of urls) {
              if (urlToEvDir[u]) { evId = urlToEvDir[u]; break }
            }
          }
          if (!evId) continue
          const evDirPath = evBase + '/' + evId + '/evidence.json'
          if (!existsSync(evDirPath)) continue
          try {
            const meta = JSON.parse(readFileSync(evDirPath, 'utf-8'))
            item.evidence = [{
              type: 'screenshot',
              path: 'evidence/' + evId + '/screenshot.png',
              caption: (meta.claim?.text || '').slice(0, 100) || item.title,
              confidence: meta.scoring?.overall || 0,
            }]
          } catch {}
        }
      }
      injectEvidence(article.deep_items)
      injectEvidence(article.important_items)
      injectEvidence(article.brief_items)
    }

    let sources = []
    try {
      const curated = JSON.parse(readFileSync(baseDir + '/' + date + '/curated.json', 'utf-8'))
      sources = [...new Set((curated.selected_items || []).map(i => i.source?.name || i.source_name).filter(Boolean))]
    } catch {}
    const md = renderArticle(article, { sources, curatedCount: (article.summary_items?.length || 0) + (article.deep_items?.length || 0) })
    writeFileSync(baseDir + '/' + date + '/article.md', md)
    console.log(date + ': rendered ' + md.length + ' chars')
  } catch (e) {
    console.error(date + ' (' + baseDir + '): ' + e.message)
    process.exit(1)
  }
}
