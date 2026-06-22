/**
 * pipeline-runner.mjs
 *
 * AI 日报工作流的核心编排引擎。
 * 本文件定义了 5 个阶段的完整 pipeline，每个阶段由一组 agent 完成。
 *
 * 这个文件本身不是被 Claude Code "运行"的 -- 它是工作流的参考实现蓝图。
 * 实际执行由 Claude Code 的 CLAUDE.md 指令驱动，agent 按此蓝图的阶段逻辑
 * 调用 WebSearch / WebFetch / Bash 等工具。
 *
 * 本文件的用途：
 *   1. 作为 CLAUDE.md 的补充，让 agent 理解完整流程
 *   2. 提供数据 schema 定义（每个阶段的输入输出格式）
 *   3. 提供 prompt 模板（每个 agent 的系统提示词）
 *   4. 定义容错逻辑（重试 / 降级 / 去重）
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 第一部分：数据源配置
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const DATA_SOURCES = {
  // ── A 类：RSS 源（通过 Bash 调用外部解析器） ──
  rss: [
    {
      id: "huggingface",
      name: "Hugging Face Blog",
      url: "https://huggingface.co/blog/feed.xml",
      category: "开源模型",
      reliability: "high",
    },
    {
      id: "openai",
      name: "OpenAI Blog",
      url: "https://openai.com/blog/rss.xml",
      category: "公司动态",
      reliability: "high",
    },
    {
      id: "google-ai",
      name: "Google AI Blog",
      url: "https://blog.google/technology/ai/rss/",
      category: "公司动态",
      reliability: "high",
    },
    {
      id: "arxiv-cs-ai",
      name: "arXiv CS.AI",
      url: "http://export.arxiv.org/rss/cs.AI",
      category: "学术论文",
      reliability: "high",
    },
    {
      id: "mit-tech-review",
      name: "MIT Technology Review AI",
      url: "https://www.technologyreview.com/topic/artificial-intelligence/feed",
      category: "行业分析",
      reliability: "medium",
    },
  ],

  // ── B 类：WebSearch 动态搜索 ──
  websearch: [
    {
      id: "github-trending",
      query: "site:github.com trending AI machine learning today",
      category: "开源项目",
    },
    {
      id: "techcrunch-ai",
      query: "site:techcrunch.com artificial intelligence latest news",
      category: "行业新闻",
    },
    {
      id: "general-ai-news",
      query: "AI artificial intelligence breakthrough announcement today",
      category: "综合新闻",
    },
    {
      id: "ai-product-launch",
      query: "AI product launch release announcement today",
      category: "产品发布",
    },
    {
      id: "ai-regulation",
      query: "AI regulation policy government latest",
      category: "政策监管",
    },
  ],

  // ── C 类：WebFetch 直接抓取 ──
  webfetch: [
    {
      id: "producthunt-ai",
      url: "https://www.producthunt.com/topics/artificial-intelligence",
      category: "产品发现",
    },
    {
      id: "paperswithcode",
      url: "https://paperswithcode.com/latest",
      category: "学术论文",
    },
  ],
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 第二部分：Schema 定义（每个阶段的输入输出结构）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Phase 1 输出：原始新闻条目
 * @typedef {Object} RawNewsItem
 * @property {string} id            - 唯一标识，格式: {sourceId}_{hash8}
 * @property {string} source        - 来源 ID（如 "huggingface", "github-trending"）
 * @property {string} title         - 标题
 * @property {string} summary       - 摘要（100~300字）
 * @property {string} url           - 原文链接
 * @property {string} publishedAt   - 发布时间 ISO 8601
 * @property {string} collectedAt   - 采集时间 ISO 8601
 * @property {string} category      - 分类标签
 * @property {string[]} tags        - 关键词标签
 * @property {"rss"|"websearch"|"webfetch"} method - 采集方式
 */

/**
 * Phase 2 输出：经过交叉验证的新闻条目
 * @typedef {RawNewsItem & Object} VerifiedNewsItem
 * @property {string[]} corroboratingSources  - 佐证来源列表
 * @property {number} corroboratingCount      - 佐证数量
 * @property {"confirmed"|"partial"|"unverified"|"debunked"} verificationStatus
 * @property {string} verificationNotes       - 核查备注
 */

/**
 * Phase 3 输出：评分后的新闻条目
 * @typedef {VerifiedNewsItem & Object} ScoredNewsItem
 * @property {number} noveltyScore      - 新颖度 (0-10)
 * @property {number} impactScore       - 影响力 (0-10)
 * @property {number} relevanceScore    - 相关度 (0-10)
 * @property {number} totalScore        - 综合评分 (0-10)
 * @property {"must_include"|"include"|"optional"|"skip"} tier - 筛选层级
 * @property {string} scoringReason     - 评分理由
 */

/**
 * Phase 4 输出：最终内容
 * @typedef {Object} FinalOutput
 * @property {string} article     - Markdown 格式日报文章
 * @property {string} script      - 视频口播稿
 * @property {Object} metadata    - 元数据
 * @property {string} metadata.date
 * @property {number} metadata.newsCount
 * @property {string[]} metadata.categories
 * @property {string} metadata.generatedAt
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 第三部分：Agent Prompt 模板
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const PROMPTS = {

  // ── Phase 1: 多源数据采集 Agent ──

  rssCollector: `
你是一个 RSS 新闻采集 agent。你的任务是解析 RSS feed 并提取 AI 领域的新闻。

## 输入
- RSS feed 内容（XML 文本）
- 来源配置：{sourceConfig}

## 任务
1. 解析 XML，提取每条 item 的 title / link / description / pubDate
2. 过滤：只保留与 AI / 机器学习 / 大模型 / AGI 相关的条目
3. 对每条生成：summary（100~300字中文摘要）、tags（3~5个关键词）
4. 输出结构化 JSON 数组

## 输出格式（严格 JSON）
[
  {
    "id": "{sourceId}_{hash8}",
    "source": "{sourceId}",
    "title": "标题",
    "summary": "中文摘要...",
    "url": "https://...",
    "publishedAt": "ISO 8601",
    "collectedAt": "ISO 8601",
    "category": "分类",
    "tags": ["标签1", "标签2"],
    "method": "rss"
  }
]

## 约束
- 不得编造不存在的条目。如果 feed 解析失败或为空，返回空数组 []
- summary 必忠实于原文，不得添加原文没有的细节
- 如果 pubDate 缺失，用 collectedAt 替代
`,

  webSearchCollector: `
你是一个 Web 搜索采集 agent。你的任务是执行搜索查询并提取 AI 领域新闻。

## 输入
- 搜索查询："{query}"
- 分类标签："{category}"

## 任务
1. 使用 WebSearch 工具执行查询
2. 从搜索结果中提取前 5~10 条相关结果
3. 对每条结果，用 WebFetch 抓取正文，生成 100~300 字中文摘要
4. 输出结构化 JSON 数组

## 输出格式（严格 JSON）
[
  {
    "id": "{sourceId}_{hash8}",
    "source": "{sourceId}",
    "title": "标题",
    "summary": "中文摘要...",
    "url": "https://...",
    "publishedAt": "ISO 8601 或 null",
    "collectedAt": "ISO 8601",
    "category": "{category}",
    "tags": ["标签1", "标签2"],
    "method": "websearch"
  }
]

## 约束
- 不得编造搜索结果。WebSearch 返回空 → 返回空数组 []
- 只收录 48 小时内发布的新闻
- summary 必须基于抓取到的实际正文
- 如果 WebFetch 失败（403/超时等），用搜索结果的 snippet 作为 summary，但标注 "snippet_only": true
`,

  webFetchCollector: `
你是一个 Web 抓取采集 agent。你的任务是直接抓取网页并提取 AI 相关条目。

## 输入
- 目标 URL："{url}"
- 分类标签："{category}"

## 任务
1. 使用 WebFetch 工具抓取页面
2. 从页面内容中提取 AI 相关的新闻/项目/论文条目
3. 每条生成中文摘要（100~300字）
4. 输出结构化 JSON 数组

## 输出格式（严格 JSON）
[...同 webSearchCollector...]

## 约束
- WebFetch 失败 → 返回空数组 []
- 不得编造页面上不存在的内容
- 只提取最近 48 小时内的内容
`,

  // ── Phase 2: 交叉验证 Agent ──

  crossVerifier: `
你是一个新闻事实核查 agent。你的任务是对采集到的新闻进行交叉验证。

## 输入
原始新闻条目列表（JSON 数组，可能来自多个来源）

## 验证规则

### 规则 1：多源佐证
同一条新闻如果被 2+ 个独立来源报道，corroboratingCount >= 2 → "confirmed"
只有 1 个来源 → 需要进一步核查

### 规则 2：WebSearch 补充核查
对只有 1 个来源的条目，用 WebSearch 搜索 "{title} AI" 或 "{关键词} AI news"
- 搜索结果中找到至少 1 个独立来源佐证 → "confirmed"
- 找到部分佐证（内容有出入）→ "partial"
- 完全找不到佐证 → "unverified"

### 规则 3：来源可信度
来源标记为 "high" reliability 的：初始信任度 +1
来源标记为 "medium" 的：不变
来源标记为 "low" 的：初始信任度 -1，必须有佐证才能通过

### 规则 4：反幻觉检测
以下特征标记为可疑：
- 标题中包含过于夸张的词汇（"震惊"、"颠覆"、"史上最强"）且无实质佐证
- 摘要中包含无法验证的具体数字（如 "准确率提升 99.9%"）
- 发布时间不在最近 48 小时内
- 无法找到原文链接的有效内容

## 输出格式（严格 JSON）
[
  {
    ...原始字段...,
    "corroboratingSources": ["来源1", "来源2"],
    "corroboratingCount": 2,
    "verificationStatus": "confirmed",
    "verificationNotes": "被 TechCrunch 和 VentureBeat 同时报道"
  }
]

## 约束
- "debunked" 的条目直接移除，不出现在输出中
- "unverified" 的条目保留但标记，后续阶段会降权
- 不得编造佐证来源。搜索不到就说搜索不到
- 整个验证过程需要在结果的 verificationNotes 中留痕
`,

  // ── Phase 3: 质量评分 Agent ──

  qualityScorer: `
你是一个内容质量评分 agent。你的任务是对验证后的新闻进行多维评分和筛选。

## 输入
经过交叉验证的新闻条目列表（JSON 数组）

## 评分维度（每项 0~10 分）

### 新颖度 (noveltyScore)
- 10: 首次曝光的突破性成果 / 从未报道过的新公司融资
- 7~9: 较新的进展，但已有少量报道
- 4~6: 已知话题的新角度或跟进报道
- 1~3: 旧闻重提或高度重复的内容
- 0: 完全过时

### 影响力 (impactScore)
- 10: 改变行业格局（如 GPT-5 发布、重大监管政策）
- 7~9: 重要产品发布 / 大额融资 / 重大技术突破
- 4~6: 有意义的更新 / 中等规模事件
- 1~3: 小众消息 / 局部影响
- 0: 无实质影响

### 相关度 (relevanceScore)
- 10: 直接是 AI 核心技术或产品
- 7~9: AI 强相关（如 AI 芯片、AI 监管）
- 4~6: 间接相关（如科技行业大新闻但涉及 AI）
- 1~3: 弱相关
- 0: 不相关（应过滤掉）

### 综合评分
totalScore = (noveltyScore * 0.3 + impactScore * 0.4 + relevanceScore * 0.3)
  * verificationMultiplier

verificationMultiplier:
  confirmed  → 1.0
  partial    → 0.85
  unverified → 0.6

### 筛选分层
- must_include: totalScore >= 7.5（硬新闻，必须入选）
- include: totalScore >= 5.5（好新闻，建议入选）
- optional: totalScore >= 3.5（可选，如果当天新闻少就补上）
- skip: totalScore < 3.5（不入选）

## 输出格式（严格 JSON）
[
  {
    ...原始字段...,
    "noveltyScore": 8,
    "impactScore": 7,
    "relevanceScore": 9,
    "totalScore": 7.8,
    "tier": "must_include",
    "scoringReason": "OpenAI 发布新模型，多家媒体确认，影响深远"
  }
]

## 附加规则
- 如果 must_include 条目不足 3 条，降低 include 阈值到 totalScore >= 4.5
- 如果总入选条目超过 12 条，只保留 top 12
- 评分理由必须简明扼要，一句话说清
- 最终输出按 totalScore 降序排列
`,

  // ── Phase 4: 内容生成 Agent ──

  articleWriter: `
你是一个 AI 日报文章撰写 agent。你的任务是把筛选后的新闻写成一篇结构化的日报文章。

## 输入
筛选后的新闻条目（按评分降序，JSON 数组）
日期：{date}

## 文章结构

### 头部
# AI 日报 | {date}
> 一句话今日概览（捕捉当日 AI 领域最大主题）

### 分类板块（按新闻量动态组织）
每个分类一个二级标题，包含该分类下的新闻：
## {分类名}
### {新闻标题}
{100~200字的新闻解读，不是简单复述摘要，要有分析和关联}
> 来源：{来源} | [原文链接]({url})

### 编辑点评
100~200字，总结当日 AI 领域趋势，提炼 1~2 个关键洞察。

### 尾部
---
*本日报由 AI 辅助采集与生成，新闻经多源交叉验证。*
*采集来源数：{N} | 验证通过数：{M}*

## 写作约束
- 语言：中文，专业但不晦涩
- 语气：客观、理性、有见地，不标题党
- 每条新闻解读要有增量信息（为什么重要、对行业意味着什么）
- 不得编造新闻细节。输入数据里没有的信息，不写
- Markdown 格式，适合公众号 / 博客发布
`,

  scriptWriter: `
你是一个视频口播稿撰写 agent。你的任务是把日报文章转成适合短视频的口播稿。

## 输入
- 日报文章（Markdown 格式）
- 目标时长：3~5 分钟
- 平台：B站 / 抖音 / YouTube

## 口播稿结构

### 开场 Hook（10~15秒）
一个引人注目的问题或数据，抓住观众注意力。

### 主体（按重要性排序，每条 30~60秒）
对每条 must_include 和 include 新闻：
1. 一句话说清是什么
2. 一句话说清为什么重要
3. 如果有数据/对比，用口语化方式呈现

### 收尾（15~20秒）
总结今日趋势 + 引导关注

## 写作约束
- 口语化，像在跟朋友聊天
- 短句为主，一个句子不超过 20 个字
- 不用书面化的长从句
- 数据用口语方式表达："涨了三倍" 而不是 "提升了 300%"
- 每段标注预估时长
- 参考 script.md 的格式范式

## 输出格式（Markdown）
结构为 script.md，每段前标注 [预估秒数]，便于后续视频制作对齐节奏。
`,

};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 第四部分：容错配置
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const FAULT_TOLERANCE = {

  retry: {
    maxRetries: 3,           // 每个 agent 最多重试 3 次
    backoffMs: [1000, 3000, 8000], // 指数退避
    retryableErrors: [
      "timeout",
      "rate_limit",
      "fetch_failed",
      "empty_result",       // 搜索结果为空也重试（换个关键词）
    ],
  },

  degradation: {
    // RSS 源获取失败 → 降级为 WebSearch
    rssFailureFallback: "websearch",
    // WebFetch 失败 → 降级为用搜索 snippet
    webfetchFailureFallback: "snippet_only",
    // 交叉验证时搜索为空 → 标记为 unverified 而非丢弃
    verificationEmptyFallback: "mark_unverified",
    // 最终条目不足 5 条 → 降低评分阈值
    minNewsCount: 5,
    minNewsCountFallback: "lower_threshold",
  },

  antiHallucination: {
    // 所有采集结果必须带原文 URL
    requireUrl: true,
    // 摘要不得包含输入中没有的具体数字
    noFabricatedNumbers: true,
    // 交叉验证 agent 不得编造佐证来源
    noFabricatedSources: true,
    // 内容生成 agent 的"增量分析"不得超出输入数据的合理推断范围
    analysisMustGrounded: true,
    // 所有 agent 输出必须是合法 JSON（不是自由文本）
    strictJsonOnly: true,
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 第五部分：去重逻辑
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const DEDUP_CONFIG = {
  // 跨天去重：加载最近 7 天的 index.json，检查标题相似度
  lookbackDays: 7,

  // 标题相似度阈值（Jaccard 系数）
  titleSimilarityThreshold: 0.6,

  // 相同 URL 直接判定为重复
  sameUrlIsDup: true,

  // 去重策略
  strategy: "keep_newest", // keep_newest | keep_highest_score
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 第六部分：Pipeline 编排逻辑（伪代码）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 *
 * === PHASE 1: 多源并行采集 ===
 *
 * 并行策略：
 *   - 5 个 RSS 源 → 5 个并行 agent（每个独立采集一个 feed）
 *   - 5 个 WebSearch 查询 → 5 个并行 agent（每个独立执行一个查询）
 *   - 2 个 WebFetch 目标 → 2 个并行 agent（每个独立抓取一个页面）
 *
 *   总计 12 个 agent 并行执行，互不依赖。
 *   所有 agent 完成后，汇总为 rawItems[] 数组。
 *
 *   单个 agent 超时：30 秒
 *   单个 agent 失败：不影响其他 agent，最终在 manifest 中记录失败源。
 *
 * 伪代码：
 * ```
 * async function phase1_collect(date) {
 *   const tasks = [];
 *
 *   // RSS 并行采集
 *   for (const source of DATA_SOURCES.rss) {
 *     tasks.push(
 *       withRetry(() => agent("rssCollector", { feed: fetch(source.url), sourceConfig: source }), source.id)
 *     );
 *   }
 *
 *   // WebSearch 并行采集
 *   for (const query of DATA_SOURCES.websearch) {
 *     tasks.push(
 *       withRetry(() => agent("webSearchCollector", { query: query.query, category: query.category }), query.id)
 *     );
 *   }
 *
 *   // WebFetch 并行采集
 *   for (const target of DATA_SOURCES.webfetch) {
 *     tasks.push(
 *       withRetry(() => agent("webFetchCollector", { url: target.url, category: target.category }), target.id)
 *     );
 *   }
 *
 *   const results = await Promise.allSettled(tasks);
 *   const rawItems = results
 *     .filter(r => r.status === "fulfilled")
 *     .flatMap(r => r.value);
 *
 *   // 记录失败源
 *   const failures = results
 *     .filter(r => r.status === "rejected")
 *     .map((r, i) => ({ source: tasks[i].sourceId, error: r.reason }));
 *
 *   // 写入 raw/ 目录
 *   writeJSON(`${outputDir}/raw/all-raw.json`, rawItems);
 *   writeJSON(`${outputDir}/raw/failures.json`, failures);
 *
 *   return rawItems;
 * }
 *
 *
 * === PHASE 2: 交叉验证 ===
 *
 * 串行策略：
 *   只有 1 个 agent，因为验证逻辑需要全局视角（比较所有来源）。
 *
 * 输入：rawItems[]（来自 Phase 1）
 * 输出：verifiedItems[]
 *
 * 降级：如果 rawItems 总数 < 3，跳过验证（数据太少无法交叉比对），
 *       直接标记所有为 "unverified" 并进入下一阶段。
 *
 * 伪代码：
 * ```
 * async function phase2_verify(rawItems) {
 *   if (rawItems.length < 3) {
 *     return rawItems.map(item => ({
 *       ...item,
 *       corroboratingSources: [],
 *       corroboratingCount: 0,
 *       verificationStatus: "unverified",
 *       verificationNotes: "原始数据不足 3 条，无法交叉验证",
 *     }));
 *   }
 *
 *   const verified = await agent("crossVerifier", {
 *     items: rawItems,
 *     prompt: PROMPTS.crossVerifier,
 *   });
 *
 *   writeJSON(`${outputDir}/verified/verified-news.json`, verified);
 *   return verified;
 * }
 *
 *
 * === PHASE 3: 质量评分 ===
 *
 * 串行策略：
 *   只有 1 个 agent，评分需要全局排名。
 *
 * 输入：verifiedItems[]
 * 输出：scoredItems[]（按 totalScore 降序，已分层）
 *
 * 伪代码：
 * ```
 * async function phase3_score(verifiedItems) {
 *   const scored = await agent("qualityScorer", {
 *     items: verifiedItems,
 *     prompt: PROMPTS.qualityScorer,
 *   });
 *
 *   // 应用筛选
 *   let selected = scored.filter(item => item.tier !== "skip");
 *
 *   // 条目不足时降级
 *   const mustInclude = selected.filter(i => i.tier === "must_include");
 *   if (mustInclude.length < 3) {
 *     // 降低阈值，重新筛选
 *     selected = scored.filter(item => item.totalScore >= 4.5);
 *   }
 *
 *   // 条目过多时截断
 *   if (selected.length > 12) {
 *     selected = selected.slice(0, 12);
 *   }
 *
 *   writeJSON(`${outputDir}/scored/scored-news.json`, selected);
 *   return selected;
 * }
 *
 *
 * === PHASE 4: 内容生成 ===
 *
 * 并行策略：
 *   2 个 agent 并行（文章 + 口播稿），因为它们独立工作。
 *
 * 输入：selectedItems[]（来自 Phase 3）
 * 输出：article.md + script.md
 *
 * 伪代码：
 * ```
 * async function phase4_generate(selectedItems, date) {
 *   const [article, script] = await Promise.all([
 *     agent("articleWriter", {
 *       items: selectedItems,
 *       date: date,
 *       prompt: PROMPTS.articleWriter,
 *     }),
 *     agent("scriptWriter", {
 *       items: selectedItems,
 *       date: date,
 *       prompt: PROMPTS.scriptWriter,
 *     }),
 *   ]);
 *
 *   writeFile(`${outputDir}/article.md`, article);
 *   writeFile(`${outputDir}/script.md`, script);
 *   return { article, script };
 * }
 *
 *
 * === PHASE 5: 元数据与索引更新 ===
 *
 * 串行，纯本地操作。
 *
 * 伪代码：
 * ```
 * function phase5_finalize(date, selectedItems, failures) {
 *   // 写入当天 manifest
 *   const manifest = {
 *     date,
 *     newsCount: selectedItems.length,
 *     categories: [...new Set(selectedItems.map(i => i.category))],
 *     sources: [...new Set(selectedItems.map(i => i.source))],
 *     failedSources: failures.map(f => f.source),
 *     generatedAt: new Date().toISOString(),
 *     version: "1.0.0",
 *   };
 *   writeJSON(`${outputDir}/manifest.json`, manifest);
 *
 *   // 更新全局索引
 *   const indexPath = `${OUTPUT_ROOT}/index.json`;
 *   const index = readJSON(indexPath) || { entries: [] };
 *
 *   // 去重：检查是否已有当天条目
 *   const existingIdx = index.entries.findIndex(e => e.date === date);
 *   const entry = {
 *     date,
 *     title: generateTitle(selectedItems),
 *     newsCount: selectedItems.length,
 *     articlePath: `${date}/article.md`,
 *     scriptPath: `${date}/script.md`,
 *     generatedAt: manifest.generatedAt,
 *   };
 *
 *   if (existingIdx >= 0) {
 *     index.entries[existingIdx] = entry;
 *   } else {
 *     index.entries.push(entry);
 *   }
 *
 *   // 按日期降序
 *   index.entries.sort((a, b) => b.date.localeCompare(a.date));
 *   writeJSON(indexPath, index);
 * }
 *
 *
 * === 完整 Pipeline ===
 *
 * async function runPipeline(date, outputDir) {
 *   // Phase 1: 多源并行采集
 *   const rawItems = await phase1_collect(date);
 *   console.log(`Phase 1 完成：采集到 ${rawItems.length} 条原始数据`);
 *
 *   // Phase 2: 交叉验证
 *   const verifiedItems = await phase2_verify(rawItems);
 *   const confirmed = verifiedItems.filter(i => i.verificationStatus === "confirmed").length;
 *   console.log(`Phase 2 完成：${confirmed}/${verifiedItems.length} 条通过验证`);
 *
 *   // Phase 3: 质量评分
 *   const selectedItems = await phase3_score(verifiedItems);
 *   console.log(`Phase 3 完成：筛选出 ${selectedItems.length} 条`);
 *
 *   // Phase 4: 内容生成（并行）
 *   await phase4_generate(selectedItems, date);
 *   console.log(`Phase 4 完成：article.md + script.md 已生成`);
 *
 *   // Phase 5: 元数据
 *   phase5_finalize(date, selectedItems, failures);
 *   console.log(`Pipeline 全部完成`);
 * }
 */
