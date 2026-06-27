/**
 * AI 日报 - 数据源与评分配置
 * Pipeline v3
 */

// ============================================================
// 版本管理
// ============================================================
export const PIPELINE_VERSION = 'v3'
export const PROMPT_VERSION = 'v1'
export const RENDERER_VERSION = 'v1'
export const SCHEMA_VERSION = 'v1'

// ============================================================
// RSS 数据源
// ============================================================

// RSSHub 公共实例连接池（不区分自建/公共，加 URL 即可）
export const RSSHUB_INSTANCES = [
  "https://rsshub.app",
  "https://rsshub.rssforever.com",
  "https://rsshub.pseudoyu.com",
  "https://rss.fatpandac.com",
  "https://rsshub-instance.zeabur.app",
  "https://rsshub.ktachibana.party",
  "https://rss.owo.nz",
  "https://rsshub.umzzz.com",
  "https://rsshub.isrss.com",
  "https://rss.datuan.dev",
  "https://rss.4040940.xyz",
  "https://rsshub.cups.moe",
  "https://rsshub-balancer.virworks.moe",
];

export const RSS_SOURCES = [
  // === Tier 1: 官方一手来源 ===
  {
    id: 'openai',
    name: 'OpenAI Blog',
    url: 'https://openai.com/news/rss.xml',
    tier: 1,
    language: 'en',
    category: 'official',
  },
  {
    id: 'deepmind',
    name: 'Google DeepMind',
    url: 'https://deepmind.google/blog/rss.xml',
    tier: 1,
    language: 'en',
    category: 'official',
  },
  {
    id: 'google-ai-blog',
    name: 'Google AI Blog',
    url: 'https://blog.google/technology/ai/rss/',
    tier: 1,
    language: 'en',
    category: 'official',
  },
  {
    id: 'google-research',
    name: 'Google Research',
    url: 'https://blog.research.google/feeds/posts/default',
    tier: 1,
    language: 'en',
    category: 'official',
  },
  {
    id: 'meta-engineering',
    name: 'Meta Engineering',
    url: 'https://engineering.fb.com/feed/',
    tier: 1,
    language: 'en',
    category: 'official',
  },
  {
    id: 'huggingface-blog',
    name: 'HuggingFace Blog',
    url: 'https://huggingface.co/blog/feed.xml',
    tier: 1,
    language: 'en',
    category: 'official',
  },
  {
    id: 'arxiv-cs-ai',
    name: 'arXiv CS.AI',
    url: 'https://export.arxiv.org/rss/cs.AI',
    tier: 1,
    language: 'en',
    category: 'academic',
    timeWindowHours: 48,
  },
  {
    id: 'arxiv-cs-cl',
    name: 'arXiv CS.CL (NLP)',
    url: 'https://export.arxiv.org/rss/cs.CL',
    tier: 1,
    language: 'en',
    category: 'academic',
    timeWindowHours: 48,
  },

  // === Tier 2: 权威媒体（英文，AI 专题 feed）===
  {
    id: 'mit-tech-review',
    name: 'MIT Technology Review',
    url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed',
    tier: 2,
    language: 'en',
    category: 'media',
  },
  {
    id: 'techcrunch',
    name: 'TechCrunch',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    tier: 2,
    language: 'en',
    category: 'media',
  },
  {
    id: 'the-verge',
    name: 'The Verge',
    url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    tier: 2,
    language: 'en',
    category: 'media',
    dateReliability: 'low', // RSS pubDate 可能是 updatedAt 而非 publishedAt
  },
  {
    id: 'venturebeat',
    name: 'VentureBeat AI',
    url: 'https://venturebeat.com/category/ai/feed/',
    tier: 2,
    language: 'en',
    category: 'media',
    status: 'probation',
  },
  {
    id: 'arstechnica',
    name: 'Ars Technica AI',
    url: 'https://arstechnica.com/ai/feed/',
    tier: 2,
    language: 'en',
    category: 'media',
  },
  {
    id: 'tldr-ai',
    name: 'TLDR AI',
    url: 'https://tldr.tech/api/rss/ai',
    tier: 2,
    language: 'en',
    category: 'newsletter',
  },
  {
    id: 'langchain-blog',
    name: 'LangChain Blog',
    url: 'https://blog.langchain.dev/feed',
    tier: 2,
    language: 'en',
    category: 'ecosystem',
  },
  {
    id: 'simon-willison',
    name: 'Simon Willison',
    url: 'https://simonwillison.net/atom/everything/',
    tier: 2,
    language: 'en',
    category: 'blog',
  },
  {
    id: 'import-ai',
    name: 'Import AI',
    url: 'https://importai.substack.com/feed',
    tier: 2,
    language: 'en',
    category: 'newsletter',
    enabled: false,
  },
  {
    id: 'the-batch',
    name: 'The Batch',
    url: 'https://deeplearning.ai/the-batch/feed/',
    tier: 2,
    language: 'en',
    category: 'newsletter',
    enabled: false,
  },

  // === Tier 2: 权威媒体（中文）===
  {
    id: '36kr',
    name: '36氪',
    url: 'https://36kr.com/feed',
    tier: 2,
    language: 'zh',
    category: 'media',
    requireKeywordFilter: true,
  },
  {
    id: 'qbitai',
    name: '量子位',
    url: 'https://www.qbitai.com/feed',
    tier: 2,
    language: 'zh',
    category: 'media',
  },

  // === Tier 2: 需关键词过滤的官方源 ===
  {
    id: 'microsoft-research',
    name: 'Microsoft Research',
    url: 'https://www.microsoft.com/en-us/research/feed/',
    tier: 2,
    language: 'en',
    category: 'official',
    requireKeywordFilter: true,
    status: 'probation',
  },
  {
    id: 'nvidia-blog',
    name: 'NVIDIA Blog',
    url: 'https://blogs.nvidia.com/feed/',
    tier: 2,
    language: 'en',
    category: 'official',
    requireKeywordFilter: true,
    status: 'probation',
  },

  // === Tier 3: 社区信号 ===
  {
    id: 'hackernews',
    name: 'Hacker News',
    url: 'https://hnrss.org/frontpage?q=AI&count=20',
    tier: 3,
    language: 'en',
    category: 'community',
  },
  {
    id: 'lesswrong',
    name: 'LessWrong',
    url: 'https://www.lesswrong.com/feed.xml',
    tier: 3,
    language: 'en',
    category: 'community',
  },
  {
    id: 'alignment-forum',
    name: 'Alignment Forum',
    url: 'https://www.alignmentforum.org/feed.xml',
    tier: 3,
    language: 'en',
    category: 'community',
  },

  // === RSSHub 中转源（需连接池）===
  {
    id: 'anthropic-news',
    name: 'Anthropic',
    rsshub: '/anthropic/news',
    tier: 1,
    language: 'en',
    category: 'official',
  },
  {
    id: 'anthropic-research',
    name: 'Anthropic Research',
    rsshub: '/anthropic/research',
    tier: 1,
    language: 'en',
    category: 'official',
  },
  {
    id: 'deepseek-news',
    name: 'DeepSeek',
    rsshub: '/deepseek/news',
    tier: 1,
    language: 'zh',
    category: 'official',
  },
  {
    id: 'jiqizhixin',
    name: '机器之心',
    rsshub: '/jiqizhixin',
    tier: 2,
    language: 'zh',
    category: 'media',
  },
  {
    id: 'huxiu-article',
    name: '虎嗅',
    rsshub: '/huxiu/article',
    tier: 2,
    language: 'zh',
    category: 'media',
    requireKeywordFilter: true,
  },
  {
    id: 'latepost-news',
    name: '晚点LatePost',
    rsshub: '/latepost/news',
    tier: 2,
    language: 'zh',
    category: 'media',
  },
  {
    id: 'cursor-blog',
    name: 'Cursor Blog',
    rsshub: '/cursor/blog',
    tier: 2,
    language: 'en',
    category: 'ecosystem',
  },
  {
    id: 'ollama-blog',
    name: 'Ollama Blog',
    rsshub: '/ollama/blog',
    tier: 2,
    language: 'en',
    category: 'ecosystem',
  },
]

// ============================================================
// AI 关键词过滤（用于 Tier 3 + requireKeywordFilter 源）
// ============================================================
export const AI_KEYWORDS = [
  // 英文关键词
  'artificial intelligence', 'machine learning', 'deep learning',
  'large language model', 'LLM', 'GPT', 'Claude', 'Gemini',
  'OpenAI', 'Anthropic', 'DeepSeek', 'Meta AI', 'Google AI',
  'transformer', 'neural network', 'AGI', 'AI safety',
  'computer vision', 'NLP', 'reinforcement learning',
  'diffusion model', 'generative AI', 'foundation model',
  'fine-tuning', 'RAG', 'agent', 'multimodal',
  'Llama', 'Mistral', 'Gemma', 'Copilot', 'ChatGPT',
  // 中文关键词
  '人工智能', '大模型', '深度学习', '机器学习',
  '大语言模型', 'AI', '智能体', '向量数据库',
  // 中国 AI 公司
  '百度', '文心', '通义', '千问', '豆包', 'Kimi', '智谱', '百川',
  '月之暗面', 'MiniMax', '零一万物', '商汤', '科大讯飞', '寒武纪',
  'Qwen',
]

// ============================================================
// 实体权重表（Bonus: entity weight，0-12 分）
// ============================================================
export const ENTITY_WEIGHTS = {
  top_tier: {
    entities: [
      'OpenAI', 'Google', 'DeepMind', 'Anthropic', 'Meta', 'Apple',
      'Microsoft', 'DeepSeek', 'NVIDIA', 'xAI', 'Mistral',
    ],
    score: 10,
  },
  second_tier: {
    entities: [
      'Hugging Face', 'Stability AI', 'Cohere', 'AI21', 'Inflection',
      'Character.AI', 'Midjourney', 'Runway', 'Perplexity',
      '百度', '阿里', '字节跳动', '腾讯', '华为', '小米',
    ],
    score: 6,
  },
  // v4.4: 中文实体词典
  chinese_tech: {
    entities: [
      // 科技公司
      '36氪', '36Kr', '商汤', '科大讯飞', '寒武纪', '旷视', '云从', '第四范式',
      '蚂蚁集团', '京东', '美团', '网易', '快手', '哔哩哔哩',
      '阶跃星辰', 'StepFun', '面壁智能', 'ModelBest', '昆仑万维',
      // AI 产品与模型
      '文心一言', '文心大模型', '通义千问', '通义', '豆包', 'Kimi', '智谱',
      'GLM', 'ChatGLM', '百川', 'MiniMax', '零一万物', '月之暗面',
      'DeepSeek', 'Qwen', 'SenseTime',
      '可灵', 'Kling', '即梦', 'Jimeng', '讯飞星火', '星火', 'SparkDesk',
      '天工AI', '天工', 'Skywork', 'Yi', 'MiniCPM', 'CPM',
      // AI 研究者（中国）
      '杨植麟', '王小川', '李彦宏', '马化腾', '张一鸣', '何恺明', '朱松纯',
    ],
    score: 6,
  },
  notable: {
    entities: [
      'Sam Altman', 'Demis Hassabis', 'Yann LeCun', 'Ilya Sutskever',
      'Dario Amodei', '李彦宏', '马斯克', 'Elon Musk',
      'John Jumper', 'Noam Shazeer',
    ],
    score: 5,
  },
  multi_entity_bonus: 2,
}

// ============================================================
// 事件类型权重表（Bonus: event type weight，0-12 分）
// ============================================================
export const EVENT_TYPE_WEIGHTS = {
  model_release: {
    keywords: ['发布', 'release', 'launch', 'announce', 'unveil', '新模型', '新版本'],
    regex: /\b(GPT-\d|Claude\s*\d|Gemini\s*\d|V\d|Llama\s*\d|Mistral)\b/i,
    score: 10,
  },
  funding: {
    keywords: ['融资', 'funding', 'raised', 'valuation', '估值'],
    regex: /(\$[\d.]+[bBmM]|[\d.]+亿|[\d.]+亿美元|\bbillion\b|\bmillion\b)/,
    score: 8,
  },
  policy: {
    keywords: ['政策', 'regulation', 'ban', '监管', '立法', 'government', 'EU', '白宫'],
    score: 7,
  },
  breakthrough: {
    keywords: ['breakthrough', 'state-of-the-art', 'SOTA', '突破', '首次', 'first'],
    score: 7,
  },
  open_source: {
    keywords: ['开源', 'open source', 'open-source', 'GitHub', 'Apache'],
    score: 5,
  },
  talent_movement: {
    keywords: ['加入', '离开', 'joins', 'leaves', 'hires', 'appointed', '离职', '跳槽'],
    score: 5,
  },
  partnership: {
    keywords: ['合作', 'partnership', 'collaboration'],
    score: 4,
  },
  acquisition: {
    keywords: ['收购', 'acquire', 'acquisition', '合并'],
    score: 6,
  },
  general: {
    score: 2,
  },
}

// ============================================================
// 学术信号关键词（Bonus: academic signal，0-5 分）
// ============================================================
export const ACADEMIC_SIGNALS = {
  hot_topics: [
    'agent', 'reasoning', 'alignment', 'multimodal', 'AGI',
    'safety', 'scaling law', 'RLHF', 'DPO', 'diffusion',
    'context', 'long context', 'token',
  ],
  model_names: [
    'GPT', 'Claude', 'Gemini', 'Llama', 'DeepSeek',
    'Mistral', 'Gemma', 'Qwen',
  ],
  sota_keywords: [
    'SOTA', 'state-of-the-art', 'outperform', 'surpass', 'beat',
  ],
  hot_topic_score: 1,
  model_name_score: 2,
  sota_score: 2,
}

// ============================================================
// 评分配置（Base + Bonus）
// ============================================================
export const SCORING = {
  // Base Score 四维（满分 65）
  base: {
    authority: { max: 20, tier_scores: { 1: 20, 2: 15, 3: 7 } },
    timeliness: {
      max: 15,
      thresholds: [
        { maxHours: 1, score: 15 },
        { maxHours: 3, score: 13 },
        { maxHours: 6, score: 11 },
        { maxHours: 12, score: 8 },
        { maxHours: 24, score: 5 },
        { maxHours: Infinity, score: 2 },
      ],
    },
    verifiability: {
      max: 15,
      scores: { official: 15, multi_source: 12, single_with_summary: 8, single_no_summary: 4 },
    },
    content_quality: {
      max: 15,
      has_number: 4,
      summary_long: 3,
      title_density: 5,
    },
  },
  // 学术源跨分类加分
  cross_category_bonus: 3,
  // 分级阈值
  thresholds: {
    auto: 70,
    review_min: 55,
    review_max: 69,
  },
  // 同源上限
  source_caps: {
    'arxiv-cs-ai': 5,
    'arxiv-cs-cl': 5,
    techcrunch: 3,
    '36kr': 3,
    _default: 3,
  },
}

// ============================================================
// WebSearch 补充查询（覆盖无 RSS 的官方源）
// ============================================================
export const WEBSEARCH_QUERIES = [
  { query: '"Anthropic" OR "Claude" site:anthropic.com', covers: 'Anthropic 官方动态' },
  { query: '"Meta AI" OR "FAIR" OR "Llama" site:ai.meta.com', covers: 'Meta AI 发布' },
  { query: '"Google AI" OR "Gemini" OR "Gemma" site:blog.google', covers: 'Google AI 产品' },
  { query: 'site:huggingface.co blog', covers: 'Hugging Face 社区' },
  { query: 'site:mistral.ai news', covers: 'Mistral AI 更新' },
  { query: '"AI" site:qbitai.com OR site:jiqizhixin.com', covers: '中文 AI 媒体' },
]

// ============================================================
// Workflow 配置
// ============================================================
export const WORKFLOW_CONFIG = {
  outputDir: 'output',
  dedupDays: 14,
  targetNewsCount: { min: 5, ideal: 10, max: 15 },
  fetchTimeout: 15000,
  fetchInterval: 2000,
  urlVerifyConcurrency: 5,
  urlVerifyTimeout: 10000,
  // 默认时间窗口（小时），学术源可在 source 配置中覆盖
  defaultTimeWindowHours: 24,
}
