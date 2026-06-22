/**
 * AI 日报 - 产出校验模块 (Phase 7)
 * Schema Validation + 内容质量校验
 */

// ============================================================
// Schema Validation
// ============================================================

const ARTICLE_SCHEMA = {
  required: ['hook', 'summary_items', 'editorial'],
  optional: ['deep_items', 'important_items', 'brief_items'],
  fields: {
    hook: { type: 'string', nonEmpty: true },
    summary_items: { type: 'array', minItems: 1, maxItems: 8, itemFields: ['title', 'one_liner'] },
    editorial: { type: 'object', requiredFields: ['observation', 'evidence', 'judgment', 'prediction'] },
    deep_items: { type: 'array', maxItems: 3, itemFields: ['title', 'what_happened', 'details', 'why_matters', 'implications', 'sources'] },
    important_items: { type: 'array', maxItems: 6, itemFields: ['title', 'key_point', 'analysis', 'source'] },
    brief_items: { type: 'array', maxItems: 8, itemFields: ['title', 'fact'] },
  },
}

const SCRIPT_SCHEMA = {
  required: ['hook', 'overview', 'closing'],
  optional: ['deep_items', 'quick_items'],
  fields: {
    hook: { type: 'object', requiredFields: ['text', 'duration_s'] },
    overview: { type: 'object', requiredFields: ['text', 'duration_s'] },
    closing: { type: 'object', requiredFields: ['text', 'duration_s'] },
    deep_items: { type: 'array', maxItems: 3 },
    quick_items: { type: 'array', maxItems: 8 },
  },
}

function validateSchema(data, schema) {
  const errors = []

  // 检查 required 字段
  for (const field of schema.required) {
    if (data[field] === undefined || data[field] === null) {
      errors.push(`${field}: required field missing`)
    }
  }

  // 检查字段结构
  for (const [field, rules] of Object.entries(schema.fields)) {
    const value = data[field]
    if (value === undefined || value === null) continue

    if (rules.type === 'string' && rules.nonEmpty && !value) {
      errors.push(`${field}: empty string`)
    }
    if (rules.type === 'array') {
      if (!Array.isArray(value)) {
        errors.push(`${field}: expected array, got ${typeof value}`)
      } else {
        if (rules.minItems && value.length < rules.minItems) {
          errors.push(`${field}: need at least ${rules.minItems} items, got ${value.length}`)
        }
        if (rules.maxItems && value.length > rules.maxItems) {
          errors.push(`${field}: max ${rules.maxItems} items, got ${value.length}`)
        }
        // 检查 item fields
        if (rules.itemFields) {
          for (let i = 0; i < value.length; i++) {
            for (const f of rules.itemFields) {
              if (value[i][f] === undefined) {
                errors.push(`${field}[${i}].${f}: missing`)
              }
            }
          }
        }
      }
    }
    if (rules.type === 'object') {
      if (typeof value !== 'object') {
        errors.push(`${field}: expected object, got ${typeof value}`)
      } else if (rules.requiredFields) {
        for (const f of rules.requiredFields) {
          if (value[f] === undefined || value[f] === null || value[f] === '') {
            errors.push(`${field}.${f}: required field missing or empty`)
          }
        }
      }
    }
  }

  return { passed: errors.length === 0, errors }
}

// ============================================================
// 内容质量校验
// ============================================================

const EMPTY_EXPRESSIONS = [
  '值得关注', '意义深远', '引发热议', '广泛关注', '意义重大',
  '不容忽视', '令人期待', '前景广阔', '不可忽视',
]

function validateContent(articleMarkdown, scriptMarkdown, curatedItems, articleJson, scriptJson) {
  const warnings = []

  // 1. URL 交叉比对
  const validUrls = new Set((curatedItems || []).map((i) => i.url).filter(Boolean))
  const articleUrls = (articleMarkdown || '').match(/https?:\/\/[^\s\)]+/g) || []
  const hallucinatedUrls = articleUrls.filter((u) => !validUrls.has(u))
  if (hallucinatedUrls.length > 0) {
    warnings.push({ check: 'hallucinated_urls', detail: `发现 ${hallucinatedUrls.length} 个编造 URL`, urls: hallucinatedUrls })
  }

  // 2. 空洞表述检测
  let emptyCount = 0
  const text = `${articleMarkdown || ''} ${scriptMarkdown || ''}`
  for (const expr of EMPTY_EXPRESSIONS) {
    const regex = new RegExp(expr, 'g')
    const matches = text.match(regex)
    if (matches) emptyCount += matches.length
  }
  if (emptyCount > 3) {
    warnings.push({ check: 'empty_expressions', detail: `空洞表述 ${emptyCount} 处（阈值 3）` })
  }

  // 3. 口播稿时长校验
  if (scriptJson) {
    const totalDuration = [
      scriptJson.hook?.duration_s || 0,
      scriptJson.overview?.duration_s || 0,
      ...(scriptJson.deep_items || []).map((i) => i.duration_s || 0),
      ...(scriptJson.quick_items || []).map((i) => i.duration_s || 0),
      scriptJson.closing?.duration_s || 0,
    ].reduce((a, b) => a + b, 0)
    if (totalDuration < 180 || totalDuration > 300) {
      warnings.push({ check: 'script_duration', detail: `总时长 ${totalDuration}s（期望 180-300）` })
    }
  }

  // 4. editorial 字段长度
  if (articleJson?.editorial) {
    for (const field of ['observation', 'evidence', 'judgment', 'prediction']) {
      const text = articleJson.editorial[field]
      if (text && text.length < 30) {
        warnings.push({ check: 'editorial_too_short', detail: `editorial.${field}: ${text.length} 字（最少 30）` })
      }
    }
  }

  // 5. deep_items details 含数字
  if (articleJson?.deep_items) {
    for (const item of articleJson.deep_items) {
      if (item.details && !/\d/.test(item.details)) {
        warnings.push({ check: 'deep_item_no_number', detail: `"${item.title}" 的 details 不含数字` })
      }
    }
  }

  // 6. 事实锚定检查
  const knownNumbers = new Set()
  for (const item of curatedItems || []) {
    const text = `${item.summary_zh || ''} ${item.title || ''}`
    const nums = text.match(/\d+[\d.,]*\s*[万亿bBmMtkg%]?/g) || []
    nums.forEach(n => knownNumbers.add(n.replace(/\s/g, '')))
  }

  // 从文章 JSON 提取数字
  const articleNumbers = []
  function extractNumbers(obj) {
    if (typeof obj === 'string') {
      const nums = obj.match(/\d+[\d.,]*\s*[万亿bBmMtkg%]?/g) || []
      articleNumbers.push(...nums.map(n => n.replace(/\s/g, '')))
    } else if (Array.isArray(obj)) {
      obj.forEach(extractNumbers)
    } else if (typeof obj === 'object' && obj !== null) {
      Object.values(obj).forEach(extractNumbers)
    }
  }
  extractNumbers(articleJson)

  // 检查是否有文章独有的数字（潜在编造）
  const suspiciousNumbers = articleNumbers.filter(n => {
    if (n.length < 2) return false // 忽略单个数字
    // 检查是否在已知数字中（模糊匹配：数字部分相同）
    const numPart = n.match(/\d+[\d.,]*/)
    if (!numPart) return false
    const knownNums = [...knownNumbers].map(k => k.match(/\d+[\d.,]*/)?.[0]).filter(Boolean)
    return !knownNums.some(k => k === numPart[0])
  })

  if (suspiciousNumbers.length > 0) {
    warnings.push({
      check: 'fact_anchoring',
      detail: `文章中出现 ${suspiciousNumbers.length} 个原始数据中不存在的数字`,
      numbers: suspiciousNumbers.slice(0, 5)
    })
  }

  // 7. 日期一致性检查
  const dateViolations = []
  for (const item of curatedItems || []) {
    if (item.published_at || item.publishedAt) {
      const pubDate = new Date(item.published_at || item.publishedAt)
      // 检查是否在合理窗口内（从 article.md 的标题中提取日期作为目标日期）
      const articleDate = (articleMarkdown || '').match(/\d{4}-\d{2}-\d{2}/)?.[0]
      if (articleDate) {
        const targetDate = new Date(articleDate + 'T12:00:00Z')
        const diffHours = Math.abs(pubDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60)
        if (diffHours > 36) {
          dateViolations.push({
            title: item.title?.slice(0, 40),
            published_at: item.published_at || item.publishedAt,
            hours_diff: diffHours.toFixed(1)
          })
        }
      }
    }
  }
  if (dateViolations.length > 0) {
    warnings.push({
      check: 'date_consistency',
      detail: `${dateViolations.length} 条新闻发布时间超出目标日期 ±36h 窗口`,
      violations: dateViolations
    })
  }

  const critical = warnings.filter((w) =>
    ['hallucinated_urls', 'empty_expressions', 'editorial_too_short', 'date_consistency'].includes(w.check)
  )

  return {
    passed: critical.length === 0,
    warnings,
    summary: {
      hallucinated_url_count: hallucinatedUrls.length,
      empty_expression_count: emptyCount,
    },
  }
}

// ============================================================
// 文章-口播稿一致性校验
// ============================================================

export function validateConsistency(articleJson, scriptJson) {
  const warnings = []

  // 提取文章中的标题
  const articleTitles = new Set()
  for (const item of articleJson?.deep_items || []) articleTitles.add(item.title)
  for (const item of articleJson?.important_items || []) articleTitles.add(item.title)

  // 提取口播稿中的标题
  const scriptTitles = new Set()
  for (const item of scriptJson?.deep_items || []) scriptTitles.add(item.title)
  for (const item of scriptJson?.quick_items || []) scriptTitles.add(item.title)

  // 计算一致性
  const intersection = [...articleTitles].filter(t => scriptTitles.has(t))
  const union = new Set([...articleTitles, ...scriptTitles])
  const consistency = union.size > 0 ? intersection.length / union.size : 1

  if (consistency < 0.5) {
    warnings.push({
      check: 'article_script_consistency',
      detail: `文章与口播稿新闻选取一致性 ${(consistency * 100).toFixed(0)}%（阈值 50%）`,
      article_only: [...articleTitles].filter(t => !scriptTitles.has(t)),
      script_only: [...scriptTitles].filter(t => !articleTitles.has(t)),
    })
  }

  return { consistency, warnings }
}

// ============================================================
// 主校验入口
// ============================================================

/**
 * 校验文章和口播稿
 * @param {string} articleMarkdown - 渲染后的文章 Markdown
 * @param {string} scriptMarkdown - 渲染后的脚本 Markdown
 * @param {Array} curatedItems - curated.json 中的条目
 * @param {object} articleJson - LLM 输出的 article.json
 * @param {object} scriptJson - LLM 输出的 script.json
 * @returns {{ articlePassed: boolean, scriptPassed: boolean, contentPassed: boolean, details: object }}
 */
export function validate(articleMarkdown, scriptMarkdown, curatedItems, articleJson, scriptJson) {
  const articleSchema = validateSchema(articleJson, ARTICLE_SCHEMA)
  const scriptSchema = validateSchema(scriptJson, SCRIPT_SCHEMA)
  const content = validateContent(articleMarkdown, scriptMarkdown, curatedItems, articleJson, scriptJson)
  const consistency = validateConsistency(articleJson, scriptJson)

  return {
    articlePassed: articleSchema.passed,
    scriptPassed: scriptSchema.passed,
    contentPassed: content.passed,
    consistency: consistency.consistency,
    details: {
      article_schema: articleSchema,
      script_schema: scriptSchema,
      content: content,
      consistency: consistency,
    },
    validation_passed: articleSchema.passed && scriptSchema.passed && content.passed && consistency.warnings.length === 0,
  }
}
