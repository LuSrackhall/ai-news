/**
 * AI 日报 - Dynamic Workflow
 *
 * 基于橘鸦模式：RSS 采集 → AI 初筛 → AI 精选 → AI 生成 → 归档
 * 用法: 通过 Claude Code 运行，或 claude -p "运行 /ai-ribao-daily"
 *
 * 核心设计原则（来自橘鸦实践）：
 * 1. 采集是代码（零 LLM 成本）
 * 2. 筛选是 AI（需要理解力）
 * 3. 精选是 AI + 严格提示词（模拟人工审核）
 * 4. 生成是高质量 AI（Claude Sonnet）
 * 5. 校对是 AI + 严格提示词（模拟人工校对）
 */

export const meta = {
  name: 'ai-ribao-daily',
  description: 'AI 日报自媒体 - 基于橘鸦模式的完整工作流',
  phases: [
    { title: 'RSS 采集', detail: 'Node.js 脚本并行抓取 RSS（零 LLM 成本）' },
    { title: 'AI 初筛', detail: '摘要/关键词/去重/打分（4 个任务并行）' },
    { title: 'AI 精选', detail: '模拟人工精选：只保留最权威信源' },
    { title: 'AI 生成', detail: '文章 + 口播稿并行生成' },
    { title: '归档', detail: '写入文件 + 更新索引' },
  ],
}

// ============================================================
// Phase 0: RSS 采集（零 LLM 成本）
// ============================================================
const phase = (title) => {
  /* phase marker - actual implementation in Workflow runtime */
}

// ============================================================
// 主流程
// ============================================================

// --- Phase 1: RSS 采集 ---
phase('RSS 采集')
log('📡 开始 RSS 采集...')

const collectResult = await agent(
  `你是一个脚本执行器。运行以下命令采集 RSS 数据，然后报告结果。

执行命令:
\`\`\`
node scripts/collect-rss.mjs
\`\`\`

运行完毕后，读取最新的 output 目录下的 all-raw.json 文件，报告：
1. 成功采集了几个源
2. 总共多少条新闻
3. 失败了几个源（如果有）

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

// --- Phase 2: AI 初筛（橘鸦模式的 4 个任务）---
phase('AI 初筛')
log('🔍 开始 AI 初筛（摘要/关键词/去重/打分）...')

const filteredResult = await agent(
  `你是一位资深 AI 新闻编辑。你的任务是对采集到的原始新闻进行初筛。

## 你的工作（橘鸦模式的 4 个任务）

### 任务 1: 摘要生成
为每条新闻生成 50 字以内的中文摘要，帮助快速判断内容价值。

### 任务 2: 关键词提取
提取核心关键词（如 "GPT-5", "融资", "开源"），用于分类归组。
将同一事件的多条报道归到同一关键词组下。

### 任务 3: 旧闻排除
- 标题或内容实质相同（同义改写也算）的新闻只保留最早/最权威的一条
- 如果新闻描述的事件发生在 48 小时以上前，标记为"疑似旧闻"

### 任务 4: 智能打分（五维百分制）
对每条新闻打分（0-100）：

**权威性（30 分）**：
- Tier 1（官方博客/arXiv）: 30 分
- Tier 2（权威媒体）: 23 分
- Tier 3（社区）: 10 分

**时效性（25 分）**：
- < 2 小时: 25 分
- 2-6 小时: 22 分
- 6-12 小时: 18 分
- 12-24 小时: 12 分
- > 24 小时: 6 分

**影响力（20 分）**：
- 头部公司重大发布（OpenAI/Google/Anthropic/Meta）: 20 分
- 融资 > 1 亿美元: 18 分
- 政策法规变化: 16 分
- 热门开源项目（GitHub stars > 1k）: 15 分
- 普通产品更新: 8 分
- 无影响力信号: 4 分

**可验证性（15 分）**：
- 有官方原始链接: 15 分
- 有多个独立来源报道: 13 分
- 单一二手来源: 4 分
- 无法追溯: 0 分

**内容质量（10 分）**：
- 含具体数据/引语/技术细节: 10 分
- 内容完整但缺深度: 7 分
- 仅一句话快讯: 4 分

## 输出规则
- 总分 >= 75 且权威性 >= 23: tier = "auto"（自动入选）
- 总分 60-74 且权威性 >= 18: tier = "review"（待确认）
- 其他: tier = "skip"（排除）
- 只输出 tier 为 "auto" 或 "review" 的条目
- 按 totalScore 降序排列

## 输入数据
读取文件: ${collectResult.output_path}

## 输出格式（严格 JSON）
{
  "filtered_items": [
    {
      "id": "原始ID",
      "title": "原始标题",
      "url": "原始链接",
      "source_name": "来源名",
      "tier": 1,
      "summary_zh": "50字中文摘要",
      "keywords": ["关键词1", "关键词2"],
      "scores": {
        "authority": 30,
        "timeliness": 22,
        "impact": 20,
        "verifiability": 15,
        "quality": 10,
        "total": 97
      },
      "tier_label": "auto",
      "published_at": "ISO时间",
      "is_old_news": false,
      "dedup_note": "去重说明（如有）"
    }
  ],
  "stats": {
    "input_count": 100,
    "auto_count": 8,
    "review_count": 5,
    "skip_count": 87,
    "dedup_removed": 12
  }
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

log(`初筛完成: ${filteredResult.stats.auto_count} 条自动入选, ${filteredResult.stats.review_count} 条待确认`)

// --- Phase 3: AI 精选（模拟橘鸦的人工精选环节）---
phase('AI 精选')
log('🎯 开始 AI 精选（模拟人工编辑精选）...')

const curatedResult = await agent(
  `你是一位严格的 AI 新闻主编。你的任务是从初筛通过的新闻中精选出今天日报的最终内容。

## 你的原则（来自橘鸦实践）
"只保留最官方、最准确或最早的信源"

## 精选规则

### 1. 同一事件只保留一条最优来源
- 有官方来源（公司博客/公告）→ 优先官方
- 无官方来源 → 选择最早报道的权威媒体
- 同一事件的多条报道合并信息，但只算一条

### 2. 去除不值得报道的内容
- 纯粹的使用体验/教程 → 去除
- 没有实质新信息的评论文 → 去除
- 无法验证的传言/爆料 → 去除或标注"待确认"

### 3. 确保覆盖面
- 每天至少覆盖 3 个不同的主题领域（模型发布/研究突破/商业动态/开源/政策等）
- 如果某个领域新闻过多，只保留最重要的 1-2 条
- 如果某个重要领域缺失，标注"今日该领域无重大新闻"

### 4. 来源链接验证
- 每条新闻必须有可点击的原始链接
- 优先链接到一手来源（公司博客/arXiv），而非二手转述

### 5. 最终数量
- 目标: 8-12 条精选新闻
- 最少: 5 条（低于此数日报内容单薄）
- 最多: 15 条（超过此数读者看不完）

## 输入
读取 Phase 2 的输出。以下是初筛结果:
${JSON.stringify(filteredResult.filtered_items.slice(0, 50), null, 2)}

## 输出格式（严格 JSON）
{
  "curated_items": [
    {
      "id": "ID",
      "title": "标题",
      "url": "原始链接",
      "source_name": "来源",
      "summary_zh": "50字摘要",
      "keywords": ["关键词"],
      "category": "分类（模型发布/研究突破/商业动态/开源/政策/产品/其他）",
      "importance": "high/medium",
      "curation_note": "精选说明（为什么保留这条）",
      "scores": { "total": 90 }
    }
  ],
  "curation_summary": {
    "total_selected": 10,
    "categories_covered": ["模型发布", "研究突破", "商业动态"],
    "sources_used": ["OpenAI Blog", "arXiv", "TechCrunch"],
    "dropped_reasons": "简述去除的新闻及原因"
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

log(`精选完成: ${curatedResult.curation_summary.total_selected} 条, 覆盖 ${curatedResult.curation_summary.categories_covered.join('/')}`)

// --- Phase 4: AI 生成（文章 + 口播稿并行）---
phase('AI 生成')
log('✍️ 开始 AI 生成（文章 + 口播稿并行）...')

const DATE = new Date().toISOString().slice(0, 10)
const curatedData = JSON.stringify(curatedResult.curated_items, null, 2)

const [articleResult, scriptResult] = await parallel([
  // 口播稿生成
  () =>
    agent(
      `你是一位专业的短视频口播稿编剧。将以下 AI 日报内容改编为 3-5 分钟的视频口播稿。

## 输入数据
${curatedData}

## 口播稿要求（基于橘鸦视频版实践）

### 结构
[开场 Hook 10-15s] 用今天最震撼的一条新闻开场，制造悬念
[今日概览 15-20s] 快速过一遍今天有几条新闻，涉及哪些领域
[重磅新闻 60-90s] 最重要的 1-2 条新闻详细展开，说清"发生了什么、为什么重要"
[快速浏览 60-90s] 其余新闻快速带过，每条 15-20 秒
[收尾 10-15s] 总结今天的关键趋势 + 引导关注

### 风格
- 口语化，像跟朋友聊天
- 短句为主，一句不超过 20 字
- 数字口语化："涨了三倍" 不是 "提升了 300%"
- 有节奏感：重点新闻慢讲，快讯快讲
- 不要用"大家好我是XX"这种老套开场

### 输出格式
每段前标注 [预估秒数]
Markdown 格式

## 校对要求（模拟人工校对）
- 检查每条新闻的数字是否与原文一致
- 确保没有编造原文没有的信息
- 确保所有新闻都有来源提及`,
      {
        label: '口播稿生成',
        phase: 'AI 生成',
        model: 'sonnet',
      }
    ),

  // 文章生成
  () =>
    agent(
      `你是一位专业的 AI 领域编辑。将以下 AI 日报内容编写为公众号/网站文章。

## 输入数据
${curatedData}

## 文章要求（基于橘鸦文字版实践）

### 结构
# AI 日报 | ${DATE}
> 一句话今日概览（最有新闻价值的那条作为钩子）

## 今日速览
3-5 条新闻的标题 + 一句话摘要（让读者 10 秒决定是否继续读）

## 重磅新闻
1-2 条，每条 300-500 字深度解读
- 发生了什么
- 为什么重要
- 对行业意味着什么
> 来源：[原文链接]

## 重要动态
3-5 条，每条 100-200 字
- 交代事实
- 一句话点评
> 来源：[原文链接]

## 快讯
3-5 条，每条 50 字以内，纯事实

## 编辑观点
100-150 字的趋势分析（标注为"编辑观点"，与事实新闻区分）

---
*数据来源: ${curatedResult.curation_summary.sources_used ? curatedResult.curation_summary.sources_used.join('、') : '多个权威来源'} | AI 辅助生成，经人工审核*

## 校对要求（模拟人工校对）
- 每条新闻必须附原始来源链接
- 检查数字/日期/公司名是否与原文一致
- 不得编造原文没有的细节
- 保持客观中立，不使用耸动标题
- 中文，专业但不晦涩`,
      {
        label: '文章生成',
        phase: 'AI 生成',
        model: 'sonnet',
      }
    ),
])

log(`文章生成完成: ${articleResult.length} 字`)
log(`口播稿生成完成: ${scriptResult.length} 字`)

// --- Phase 5: 归档 ---
phase('归档')
log('📁 开始归档...')

const archiveResult = await agent(
  `你是一个文件写入器。将以下内容写入对应的文件。

## 需要写入的文件

### 1. 日报文章
文件路径: output/${DATE}/article.md
内容:
${typeof articleResult === 'string' ? articleResult : JSON.stringify(articleResult)}

### 2. 视频口播稿
文件路径: output/${DATE}/script.md
内容:
${typeof scriptResult === 'string' ? scriptResult : JSON.stringify(scriptResult)}

### 3. 精选数据
文件路径: output/${DATE}/curated.json
内容: ${JSON.stringify(curatedResult, null, 2)}

### 4. 采集元数据
文件路径: output/${DATE}/manifest.json
内容: ${JSON.stringify(
    {
      date: DATE,
      collectedAt: new Date().toISOString(),
      sources: collectResult,
      filtering: filteredResult.stats,
      curation: curatedResult.curation_summary,
      generated: {
        article_length: typeof articleResult === 'string' ? articleResult.length : 0,
        script_length: typeof scriptResult === 'string' ? scriptResult.length : 0,
      },
    },
    null,
    2
  )}

请依次创建 output/${DATE}/ 目录并写入以上 4 个文件。写入完成后报告每个文件的路径和大小。`,
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

// ============================================================
// 完成
// ============================================================
log('✅ AI 日报工作流执行完成')

return {
  status: 'success',
  date: DATE,
  collect: collectResult,
  filter: filteredResult.stats,
  curation: curatedResult.curation_summary,
  archive: archiveResult,
}
