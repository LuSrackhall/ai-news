/**
 * ValidationPolicy — Schema + 内容质量校验
 * 纯计算，不碰 IO
 */

const EMPTY_EXPRESSIONS = [
  '值得关注', '意义深远', '引发热议', '广泛关注', '意义重大',
  '不容忽视', '令人期待', '前景广阔', '不可忽视',
]

export class ValidationPolicy {
  execute({ article, script, curatedEvents, articleMarkdown, scriptMarkdown }) {
    const articleContent = article?.content || article
    const scriptContent = script?.content || script

    const content = this.validateContent(articleMarkdown, scriptMarkdown, curatedEvents, articleContent, scriptContent)
    const consistency = this.validateConsistency(articleContent, scriptContent)

    return {
      contentPassed: content.passed,
      consistency: consistency.consistency,
      details: { content, consistency },
      validation_passed: content.passed && consistency.warnings.length === 0,
    }
  }

  validateContent(articleMd, scriptMd, events, articleContent, scriptContent) {
    const warnings = []

    // 1. URL 交叉比对
    const validUrls = new Set((events || []).map((e) => e.url).filter(Boolean))
    const articleUrls = (articleMd || '').match(/https?:\/\/[^\s\)]+/g) || []
    const hallucinatedUrls = articleUrls.filter((u) => !validUrls.has(u))
    if (hallucinatedUrls.length > 0) {
      warnings.push({ check: 'hallucinated_urls', detail: `${hallucinatedUrls.length} 个编造 URL` })
    }

    // 2. 空洞表述
    let emptyCount = 0
    const text = `${articleMd || ''} ${scriptMd || ''}`
    for (const expr of EMPTY_EXPRESSIONS) {
      const matches = text.match(new RegExp(expr, 'g'))
      if (matches) emptyCount += matches.length
    }
    if (emptyCount > 3) warnings.push({ check: 'empty_expressions', detail: `${emptyCount} 处` })

    // 3. 播客脚本时长
    if (scriptContent) {
      const getDur = (s) => s?.durationS || s?.duration_s || 0
      const isDialogue = (item) => Array.isArray(item)
      const dialogueDur = (lines) => Array.isArray(lines) ? lines.reduce((s, l) => s + getDur(l), 0) : 0
      const itemDur = (item) => item.dialogue ? dialogueDur(item.dialogue) : getDur(item)

      const allDurations = []
      if (scriptContent.hook) allDurations.push(isDialogue(scriptContent.hook) ? dialogueDur(scriptContent.hook) : getDur(scriptContent.hook))
      if (scriptContent.overview) allDurations.push(isDialogue(scriptContent.overview) ? dialogueDur(scriptContent.overview) : getDur(scriptContent.overview))
      for (const i of (scriptContent.deepItems || scriptContent.deep_items || [])) allDurations.push(itemDur(i))
      for (const i of (scriptContent.quickItems || scriptContent.quick_items || [])) allDurations.push(itemDur(i))
      if (scriptContent.closing) allDurations.push(isDialogue(scriptContent.closing) ? dialogueDur(scriptContent.closing) : getDur(scriptContent.closing))
      const totalDuration = allDurations.reduce((a, b) => a + b, 0)
      if (totalDuration < 180 || totalDuration > 300) {
        warnings.push({ check: 'script_duration', detail: `${totalDuration}s` })
      }
    }

    // 4. editorial 长度
    const editorial = articleContent?.editorial
    if (editorial) {
      for (const field of ['observation', 'evidence', 'judgment']) {
        if (editorial[field] && editorial[field].length < 30) {
          warnings.push({ check: 'editorial_too_short', detail: `${field}: ${editorial[field].length} 字` })
        }
      }
    }

    // 5. deep_items 含数字
    const deepItems = articleContent?.deepItems || articleContent?.deep_items || []
    for (const item of deepItems) {
      if (item.details && !/\d/.test(item.details)) {
        warnings.push({ check: 'deep_item_no_number', detail: `"${item.title}"` })
      }
    }

    const critical = warnings.filter((w) =>
      ['hallucinated_urls', 'empty_expressions', 'editorial_too_short'].includes(w.check)
    )
    return { passed: critical.length === 0, warnings }
  }

  validateConsistency(articleContent, scriptContent) {
    const articleTitles = new Set()
    for (const item of articleContent?.deepItems || articleContent?.deep_items || []) articleTitles.add(item.title)
    for (const item of articleContent?.importantItems || articleContent?.important_items || []) articleTitles.add(item.title)

    const scriptTitles = new Set()
    for (const item of scriptContent?.deepItems || scriptContent?.deep_items || []) scriptTitles.add(item.title)
    for (const item of scriptContent?.quickItems || scriptContent?.quick_items || []) scriptTitles.add(item.title)

    const intersection = [...articleTitles].filter(t => scriptTitles.has(t))
    const union = new Set([...articleTitles, ...scriptTitles])
    const consistency = union.size > 0 ? intersection.length / union.size : 1

    const warnings = []
    if (consistency < 0.5) {
      warnings.push({ check: 'consistency', detail: `${(consistency * 100).toFixed(0)}%` })
    }
    return { consistency, warnings }
  }
}
