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

  const critical = warnings.filter((w) =>
    ['hallucinated_urls', 'empty_expressions', 'editorial_too_short'].includes(w.check)
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

  return {
    articlePassed: articleSchema.passed,
    scriptPassed: scriptSchema.passed,
    contentPassed: content.passed,
    details: {
      article_schema: articleSchema,
      script_schema: scriptSchema,
      content: content,
    },
    validation_passed: articleSchema.passed && scriptSchema.passed && content.passed,
  }
}
