## ADDED Requirements

### Requirement: RSS 源 AI 专题 Feed

config.mjs SHALL 将 TechCrunch、MIT Technology Review、The Verge 的 RSS URL 切换到 AI 专题子 feed，减少 80%+ 非 AI 噪音。

#### Scenario: TechCrunch AI 专题 feed
- **WHEN** 系统采集 TechCrunch 源
- **THEN** 使用 URL `https://techcrunch.com/category/artificial-intelligence/feed/` 而非全站 feed

#### Scenario: 噪音降低验证
- **WHEN** 使用 AI 专题 feed 采集 TechCrunch，获取 20 条新闻
- **THEN** 其中 AI 相关条目占比 >= 80%（对比全站 feed 的约 20%）

### Requirement: 新增官方源

config.mjs SHALL 新增以下 Tier 1 源：Google DeepMind (`https://deepmind.google/blog/rss.xml`)。新增以下 Tier 2 源：VentureBeat AI (`https://venturebeat.com/category/ai/feed/`)、Ars Technica AI (`https://arstechnica.com/tag/ai/feed/`)、Import AI (`https://importai.substack.com/feed`)、The Batch (`https://deeplearning.ai/the-batch/feed/`)。Microsoft Research 和 NVIDIA Blog 需要关键词过滤（使用 AI_KEYWORDS）。

#### Scenario: DeepMind 源采集
- **WHEN** 系统采集 DeepMind Blog RSS
- **THEN** 获取的条目 tier=1, authority=20, 无需关键词过滤

#### Scenario: Microsoft Research 关键词过滤
- **WHEN** Microsoft Research 一条新闻标题为 "Azure DevOps new features"，不包含 AI_KEYWORDS
- **THEN** 该条被 filter 阶段淘汰

### Requirement: OpenAI RSS URL 修复

config.mjs SHALL 将 OpenAI Blog 的 RSS URL 从 `https://openai.com/news/rss` 修改为 `https://openai.com/news/rss.xml`。

#### Scenario: OpenAI RSS 不再 403
- **WHEN** 系统采集 OpenAI Blog（使用新 URL）
- **THEN** HTTP 状态码为 200，成功解析 RSS 条目

### Requirement: 36kr 关键词过滤

config.mjs SHALL 对 36kr 源启用关键词过滤（当前 Tier 2 源不需要过滤，但 36kr 噪音过高）。AI_KEYWORDS 列表 SHALL 扩充中国 AI 公司关键词：百度、文心、通义、千问、豆包、Kimi、智谱、百川、月之暗面、MiniMax、零一万物、商汤、科大讯飞、寒武纪、Qwen。

#### Scenario: 36kr 非 AI 新闻过滤
- **WHEN** 36kr 新闻标题为 "拼多多Q1营收超预期"，不匹配任何 AI_KEYWORDS
- **THEN** 该条被 filter 淘汰

#### Scenario: 36kr AI 新闻通过
- **WHEN** 36kr 新闻标题为 "百度文心大模型4.5发布"，匹配关键词 "百度" 和 "文心"
- **THEN** 该条通过 filter 进入评分

### Requirement: WebSearch 补充策略

config.mjs SHALL 定义 6 个 WebSearch 查询覆盖无 RSS 的官方源：Anthropic/Claude、Meta AI/Llama、Google AI/Gemini、Hugging Face、Mistral AI、中文 AI 媒体。

#### Scenario: Anthropic 动态补充
- **WHEN** Anthropic 发布新模型但无 RSS 源
- **THEN** WebSearch 查询 "Anthropic" OR "Claude" site:anthropic.com 捕获该新闻

#### Scenario: WebSearch 结果与 RSS 去重
- **WHEN** WebSearch 返回的新闻 URL 已存在于 RSS 采集结果中
- **THEN** dedup 模块的 Level 1 URL 匹配将其去重
