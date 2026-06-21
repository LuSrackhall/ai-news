/**
 * AI 日报 - Dynamic Workflow v2
 *
 * 基于橘鸦模式：RSS 采集 → AI 初筛 → AI 精选 → URL 验证 → AI 生成 → 归档
 *
 * v2 修复：
 * - 严格 24h 时间窗口
 * - 禁止 LLM 编造/截断 URL（必须原样复制输入数据中的 URL）
 * - 新增 URL 验证 Phase（curl 检查每条链接的 HTTP 状态码）
 * - 精选 prompt 加强日期过滤
 */

export const meta = {
  name: 'ai-ribao-daily',
  description: 'AI 日报自媒体 - 基于橘鸦模式（v2 修复 URL 幻觉 + 日期过滤）',
  phases: [
    { title: 'RSS 采集', detail: 'Node.js 脚本并行抓取 RSS（零 LLM 成本）' },
    { title: 'AI 初筛', detail: '摘要/关键词/去重/打分' },
    { title: 'AI 精选', detail: '模拟人工精选 + 严格日期过滤' },
    { title: 'URL 验证', detail: 'curl 检查每条链接是否真实可访问' },
    { title: 'AI 生成', detail: '文章 + 口播稿并行生成' },
    { title: '归档', detail: '写入文件' },
  ],
}

// ============================================================
// 主流程 — 日期通过 args 传入，禁止使用 new Date()
// ============================================================
const DATE = (args && args.date) || (typeof process !== 'undefined' && process.env && process.env.AI_RIBAO_DATE) || '2026-06-21'

// --- Phase 1: RSS 采集 ---
phase('RSS 采集')
log('📡 开始 RSS 采集...')

const collectResult = await agent(
  `你是一个脚本执行器。运行以下命令采集 RSS 数据，然后报告结果。

执行命令:
\`\`\`
node scripts/collect-rss.mjs --date ${DATE}
\`\`\`

运行完毕后，报告：
1. 成功采集了几个源
2. 总共多少条新闻
3. 失败了几个源

不要修改任何数据，只报告采集结果。`,
  {
    label: 'RSS 采集',
    phase: 'RSS 采集',
    model: 'haiku',
    schema: {
      type: 'object',
      properties: {
        sources_ok: { type: 'number' },
        sources_error: { type: 'number' },
        total_items: { type: 'number' },
        output_path: { type: 'string' },
        failures: { type: 'array', items: { type: 'string' } },
      },
      required: ['sources_ok', 'total_items', 'output_path'],
    },
  }
)

log(`采集完成: ${collectResult.total_items} 条来自 ${collectResult.sources_ok} 个源`)

if (collectResult.total_items < 3) {
  log('⚠️ 采集条目不足 3 条，终止工作流')
  return { status: 'aborted', reason: 'insufficient_items', collectResult }
}

// --- Phase 2: AI 初筛 ---
phase('AI 初筛')
log('🔍 开始 AI 初筛...')

const filteredResult = await agent(
  `你是一位资深 AI 新闻编辑。对采集到的原始新闻进行初筛。

## 四个任务

### 任务 1: 摘要生成
为每条新闻生成 50 字以内的中文摘要。

### 任务 2: 关键词提取
提取核心关键词，将同一事件的多条报道归到同一关键词组。

### 任务 3: 日期过滤（严格执行）
- **只保留 publishedAt 日期为 ${DATE} 的新闻**
- publishedAt 在 ${DATE} 之前（更早日期）的新闻，直接排除，不进入后续流程
- 如果 publishedAt 为空但 URL 中包含日期（如 /2026/06/18/），以 URL 日期为准

### 任务 4: 智能打分（五维百分制）

**权威性（30 分）**：Tier1=30, Tier2=23, Tier3=10
**时效性（25 分）**：<2h=25, 2-6h=22, 6-12h=18, 12-24h=12, >24h=6
**影响力（20 分）**：头部公司发布=20, 融资>1亿=18, 政策=16, 开源=15, 普通=8
**可验证性（15 分）**：官方链接=15, 多源=13, 单源=4
**内容质量（10 分）**：含数据=10, 完整=7, 快讯=4

## 输出规则
- 总分 >= 75 且权威性 >= 23: tier = "auto"
- 总分 60-74 且权威性 >= 18: tier = "review"
- 其他: tier = "skip"（不输出）
- ⚠️ url 字段必须原样复制输入数据中的完整 URL，不得截断、简化或编造

## 输入数据
读取文件: ${collectResult.output_path}

## 输出格式（严格 JSON）
{
  "filtered_items": [
    {
      "id": "原始ID",
      "title": "原始标题",
      "url": "输入数据中的完整URL，原样复制",
      "source_name": "来源名",
      "tier": 1,
      "published_at": "ISO时间",
      "summary_zh": "50字中文摘要",
      "keywords": ["关键词1"],
      "scores": { "authority": 30, "timeliness": 22, "impact": 20, "verifiability": 15, "quality": 10, "total": 97 },
      "tier_label": "auto"
    }
  ],
  "stats": { "input_count": 100, "auto_count": 8, "review_count": 5, "skip_count": 87 }
}`,
  {
    label: 'AI 初筛',
    phase: 'AI 初筛',
    model: 'sonnet',
    schema: {
      type: 'object',
      properties: {
        filtered_items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              url: { type: 'string' },
              source_name: { type: 'string' },
              tier: { type: 'number' },
              summary_zh: { type: 'string' },
              keywords: { type: 'array', items: { type: 'string' } },
              scores: {
                type: 'object',
                properties: {
                  authority: { type: 'number' },
                  timeliness: { type: 'number' },
                  impact: { type: 'number' },
                  verifiability: { type: 'number' },
                  quality: { type: 'number' },
                  total: { type: 'number' },
                },
              },
              tier_label: { type: 'string' },
              published_at: { type: 'string' },
            },
            required: ['id', 'title', 'url', 'summary_zh', 'scores', 'tier_label'],
          },
        },
        stats: {
          type: 'object',
          properties: {
            input_count: { type: 'number' },
            auto_count: { type: 'number' },
            review_count: { type: 'number' },
            skip_count: { type: 'number' },
          },
        },
      },
      required: ['filtered_items', 'stats'],
    },
  }
)

log(`初筛完成: ${filteredResult.stats.auto_count} 条自动入选`)

// --- Phase 3: AI 精选 ---
phase('AI 精选')
log('🎯 开始 AI 精选...')

const curatedResult = await agent(
  `你是一位严格的 AI 新闻主编。从初筛通过的新闻中精选最终内容。

## 核心原则
"只保留最官方、最准确或最早的信源"

## 精选规则

### 1. 日期严格过滤
- **只保留 ${DATE} 当天发布的新闻**
- 如果某条新闻的 published_at 不是 ${DATE}，排除它
- 如果 URL 路径中包含的日期不是 ${DATE}（如 /2026/06/18/），排除它
- 第一天运行没有上期参考，宁可少选也不要混入旧新闻

### 2. 同一事件只保留一条最优来源
- 优先官方来源 > 权威媒体 > 社区
- 多条报道合并信息但只算一条

### 3. 去除不值得报道的内容
- 使用体验/教程 → 去除
- 无新信息的评论文 → 去除
- 无法验证的传言 → 去除

### 4. URL 必须原样复制
- ⚠️ url 字段必须从输入数据中原样复制，不得截断、简化或编造
- 如果输入数据中没有 URL，该条新闻不应入选

### 5. 数量
- 目标: 8-12 条 | 最少: 5 条 | 最多: 15 条
- 如果 ${DATE} 当天新闻不足 5 条，如实报告"今日 AI 新闻较少"，不要用旧新闻填充

## 输入
初筛结果:
${JSON.stringify(filteredResult.filtered_items.slice(0, 50), null, 2)}

## 输出格式（严格 JSON）
{
  "curated_items": [
    {
      "id": "ID",
      "title": "标题",
      "url": "原样复制输入数据中的完整URL",
      "source_name": "来源",
      "summary_zh": "50字摘要",
      "keywords": ["关键词"],
      "category": "分类",
      "importance": "high/medium",
      "published_at": "ISO时间",
      "scores": { "total": 90 }
    }
  ],
  "curation_summary": {
    "target_date": "${DATE}",
    "total_selected": 10,
    "categories_covered": ["模型发布", "研究突破"],
    "sources_used": ["arXiv", "TechCrunch"],
    "dropped_reasons": "简述去除原因"
  }
}`,
  {
    label: 'AI 精选',
    phase: 'AI 精选',
    model: 'sonnet',
    schema: {
      type: 'object',
      properties: {
        curated_items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              url: { type: 'string' },
              source_name: { type: 'string' },
              summary_zh: { type: 'string' },
              keywords: { type: 'array', items: { type: 'string' } },
              category: { type: 'string' },
              importance: { type: 'string' },
              published_at: { type: 'string' },
              scores: { type: 'object', properties: { total: { type: 'number' } } },
            },
            required: ['id', 'title', 'url', 'category', 'importance'],
          },
        },
        curation_summary: {
          type: 'object',
          properties: {
            total_selected: { type: 'number' },
            categories_covered: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      required: ['curated_items', 'curation_summary'],
    },
  }
)

log(`精选完成: ${curatedResult.curation_summary.total_selected} 条`)

// --- Phase 4: URL 验证（代码层，零 LLM 成本）---
phase('URL 验证')
log('🔗 开始 URL 验证（检查每条链接是否真实可访问）...')

const urlsToCheck = curatedResult.curated_items.map((item) => item.url).filter(Boolean)
const urlCheckScript = urlsToCheck.map((u) => `echo "CHECK|${u}|$(curl -sL -o /dev/null -w '%{http_code}' --max-time 10 '${u}' 2>/dev/null)"`).join('\n')

const urlCheckResult = await agent(
  `运行以下 bash 命令检查 URL 可访问性，然后报告结果:

\`\`\`bash
${urlCheckScript}
\`\`\`

对每个 URL 报告 HTTP 状态码。标记所有非 200 的 URL。
然后读取精选数据，移除所有返回 404 或超时的条目，输出最终有效列表。

输出格式（严格 JSON）:
{
  "valid_items": [...原始curated_items中url返回200的条目...],
  "removed_items": [{ "title": "标题", "url": "URL", "http_code": 404, "reason": "链接不存在" }],
  "stats": { "total_checked": 12, "valid": 9, "removed": 3 }
}`,
  {
    label: 'URL 验证',
    phase: 'URL 验证',
    model: 'haiku',
    schema: {
      type: 'object',
      properties: {
        valid_items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              url: { type: 'string' },
              source_name: { type: 'string' },
              summary_zh: { type: 'string' },
              keywords: { type: 'array', items: { type: 'string' } },
              category: { type: 'string' },
              importance: { type: 'string' },
              scores: { type: 'object', properties: { total: { type: 'number' } } },
            },
          },
        },
        removed_items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              url: { type: 'string' },
              http_code: { type: 'number' },
              reason: { type: 'string' },
            },
          },
        },
        stats: {
          type: 'object',
          properties: {
            total_checked: { type: 'number' },
            valid: { type: 'number' },
            removed: { type: 'number' },
          },
        },
      },
      required: ['valid_items', 'stats'],
    },
  }
)

log(`URL 验证完成: ${urlCheckResult.stats.valid} 条有效, ${urlCheckResult.stats.removed} 条移除`)

if (urlCheckResult.valid_items.length < 3) {
  log('⚠️ 有效新闻不足 3 条，终止工作流')
  return { status: 'aborted', reason: 'insufficient_valid_items', urlCheckResult }
}

// --- Phase 5: AI 生成（文章 + 口播稿并行）---
phase('AI 生成')
log('✍️ 开始 AI 生成...')

const verifiedData = JSON.stringify(urlCheckResult.valid_items, null, 2)

const [articleResult, scriptResult] = await parallel([
  // 口播稿生成
  () =>
    agent(
      `将以下 AI 日报内容改编为 3-5 分钟的视频口播稿。

## 输入数据（已验证 URL 全部有效）
${verifiedData}

## 结构
[开场 Hook 10-15s] 最震撼的一条新闻开场
[今日概览 15-20s] 几条新闻，涉及哪些领域
[重磅新闻 60-90s] 最重要的 1-2 条详细展开
[快速浏览 60-90s] 其余新闻每条 15-20 秒
[收尾 10-15s] 总结趋势 + 引导关注

## 风格
口语化、短句（≤20 字）、数字口语化、有节奏感

## ⚠️ 链接规则（最高优先级）
- **必须使用输入数据中提供的 url 字段，原样使用，不得修改**
- **禁止编造、截断、简化任何 URL**
- 如果需要提及来源，用 source_name 字段，不要凭记忆编 URL

## 输出格式
每段前标注 [预估秒数]，Markdown 格式`,
      { label: '口播稿生成', phase: 'AI 生成', model: 'sonnet' }
    ),

  // 文章生成
  () =>
    agent(
      `将以下 AI 日报内容编写为公众号/网站文章。

## 输入数据（已验证 URL 全部有效）
${verifiedData}

## 结构
# AI 日报 | ${DATE}
> 一句话钩子

## 今日速览
3-5 条标题 + 一句话摘要

## 重磅新闻
1-2 条，每条 300-500 字，附来源链接
> 来源：[原文链接]

## 重要动态
3-5 条，每条 100-200 字，附来源链接

## 快讯
3-5 条，每条 50 字以内

## 编辑观点
100-150 字趋势分析（标注"编辑观点"）

---
*AI 辅助生成，经审核 | 数据来源: ${curatedResult.curation_summary.sources_used ? curatedResult.curation_summary.sources_used.join('、') : '多个权威来源'}*

## ⚠️ 链接规则（最高优先级）
- **必须使用输入数据中提供的 url 字段，原样使用，不得修改**
- **禁止编造、截断、简化任何 URL**
- **禁止凭记忆编造 TechCrunch/arXiv 等网站的 URL**
- 如果输入数据中某条新闻没有 url，用 source_name 标注来源，不写链接`,
      { label: '文章生成', phase: 'AI 生成', model: 'sonnet' }
    ),
])

log(`文章生成完成: ${articleResult.length} 字`)
log(`口播稿生成完成: ${scriptResult.length} 字`)

// --- Phase 6: 归档 ---
phase('归档')
log('📁 开始归档...')

const archiveResult = await agent(
  `将以下内容写入对应的文件。

### 1. 日报文章
路径: output/${DATE}/article.md
内容: 请将以下文本完整写入文件（不要修改任何内容）:
---
${typeof articleResult === 'string' ? articleResult : '文章内容已生成，请读取并写入文件'}
---

### 2. 视频口播稿
路径: output/${DATE}/script.md
内容: 请将以下文本完整写入文件:
---
${typeof scriptResult === 'string' ? scriptResult : '口播稿已生成，请读取并写入文件'}
---

### 3. 精选数据
路径: output/${DATE}/curated.json
内容: ${JSON.stringify(urlCheckResult, null, 2)}

### 4. 元数据
路径: output/${DATE}/manifest.json
内容: ${JSON.stringify(
    {
      version: 'v2',
      date: DATE,
      sources: collectResult,
      filtering: filteredResult.stats,
      curation: curatedResult.curation_summary,
      url_verification: urlCheckResult.stats,
    },
    null,
    2
  )}

写入完成后报告每个文件的路径和大小。`,
  {
    label: '归档',
    phase: '归档',
    model: 'haiku',
    schema: {
      type: 'object',
      properties: {
        files_written: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              size: { type: 'number' },
            },
          },
        },
      },
      required: ['files_written'],
    },
  }
)

log(`归档完成: ${archiveResult.files_written.length} 个文件`)
log('✅ AI 日报工作流执行完成')

return {
  status: 'success',
  version: 'v2',
  date: DATE,
  collect: collectResult,
  filter: filteredResult.stats,
  curation: curatedResult.curation_summary,
  url_verification: urlCheckResult.stats,
  archive: archiveResult,
}
