/**
 * AI 日报 - 数据源配置
 * 基于橘鸦实践 + 官方 RSS 实测验证
 */

// ============================================================
// RSS 数据源（已实测可用，2026-06-20 验证）
// ============================================================
export const RSS_SOURCES = [
  // === Tier 1: 官方一手来源（英文）===
  {
    id: 'openai',
    name: 'OpenAI Blog',
    url: 'https://openai.com/news/rss',
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
  },
  {
    id: 'arxiv-cs-cl',
    name: 'arXiv CS.CL (NLP)',
    url: 'https://export.arxiv.org/rss/cs.CL',
    tier: 1,
    language: 'en',
    category: 'academic',
  },

  // === Tier 2: 权威媒体（英文）===
  {
    id: 'mit-tech-review',
    name: 'MIT Technology Review',
    url: 'https://www.technologyreview.com/feed/',
    tier: 2,
    language: 'en',
    category: 'media',
  },
  {
    id: 'techcrunch',
    name: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
    tier: 2,
    language: 'en',
    category: 'media',
  },
  {
    id: 'the-verge',
    name: 'The Verge',
    url: 'https://www.theverge.com/rss/index.xml',
    tier: 2,
    language: 'en',
    category: 'media',
  },

  // === Tier 2: 权威媒体（中文）===
  {
    id: '36kr',
    name: '36氪',
    url: 'https://36kr.com/feed',
    tier: 2,
    language: 'zh',
    category: 'media',
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
]

// ============================================================
// AI 关键词过滤（用于 RSS 粗筛）
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
  // 中文关键词
  '人工智能', '大模型', '深度学习', '机器学习',
  '大语言模型', 'AI', '智能体', '向量数据库',
]

// ============================================================
// 评分公式配置（五维百分制，基于审查意见校准）
// ============================================================
export const SCORING = {
  dimensions: [
    { name: '权威性', weight: 30 },
    { name: '时效性', weight: 25 },
    { name: '影响力', weight: 20 },
    { name: '可验证性', weight: 15 },
    { name: '内容质量', weight: 10 },
  ],
  thresholds: {
    auto_publish: 75,    // 绿灯：自动入选
    review: 60,          // 黄灯：标记待审
    min_authority: 23,   // 权威性最低门槛
  },
  tier_scores: {
    1: 30,  // 一手来源
    2: 23,  // 权威媒体
    3: 10,  // 社区信号
  },
}

// ============================================================
// Workflow 配置
// ============================================================
export const WORKFLOW_CONFIG = {
  // 输出目录
  outputDir: 'output',

  // 去重窗口（天）
  dedupDays: 7,

  // 每日精选新闻数量目标
  targetNewsCount: { min: 5, ideal: 10, max: 15 },

  // RSS 采集超时（毫秒）
  fetchTimeout: 15000,

  // RSS 请求间隔（毫秒）
  fetchInterval: 2000,
}
