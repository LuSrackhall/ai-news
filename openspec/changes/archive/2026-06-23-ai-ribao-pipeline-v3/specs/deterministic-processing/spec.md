## ADDED Requirements

### Requirement: Base Score 评分（四维）

系统 SHALL 对每条采集到的新闻计算 Base Score，包含四个维度：权威性（满分20）、时效性（满分15）、可验证性（满分15）、内容质量（满分15），总分满分 65。评分逻辑全部由代码实现，不依赖 LLM。

#### Scenario: Tier 1 权威源评分
- **WHEN** 一条新闻来自 arXiv CS.AI（Tier 1），发布于 6 小时前，含官方链接，摘要含具体数字
- **THEN** 权威性=20, 时效性=11, 可验证性=15, 内容质量>=8, Base Score >= 54

#### Scenario: Tier 3 社区源评分
- **WHEN** 一条新闻来自 Hacker News（Tier 3），发布于 18 小时前，单源无摘要
- **THEN** 权威性=7, 时效性=5, 可验证性=4, 内容质量<=5, Base Score <= 21

#### Scenario: 学术源跨分类加分
- **WHEN** 一篇 arXiv 论文同时出现在 cs.AI 和 cs.CL 的 RSS 中
- **THEN** 权威性额外 +3（上限 20）

### Requirement: Bonus 评分（可叠加，上限 35）

系统 SHALL 对每条新闻计算 Bonus 分，包含四个子类型：实体权重（0-12）、事件类型（0-12）、量化信号（0-6）、学术信号（0-5）。Bonus 与 Base Score 叠加，总分上限 100。

#### Scenario: 顶级公司发布模型（高 Bonus）
- **WHEN** 新闻标题含 "DeepSeek" + "发布" + 模型版本号
- **THEN** 实体权重>=10, 事件类型>=10, Final Score = Base + 20

#### Scenario: 普通学术论文（低 Bonus）
- **WHEN** arXiv 论文标题无知名公司名、无 SOTA 关键词、无热门话题
- **THEN** 实体权重=3, 事件类型=3, 学术信号=0, Final Score = Base + 6

#### Scenario: 融资新闻含金额（量化信号加分）
- **WHEN** 新闻摘要含 "$1.5B" 或 "15亿美元"
- **THEN** 量化信号 +2

### Requirement: 分级阈值与同源上限

系统 SHALL 按 Final Score 分级：auto >= 70, review 55-69, skip < 55。同源上限：arXiv=5, TechCrunch=3, 36kr=3, 其他=3。超出上限的条目即使评分达标也降级为 skip。

#### Scenario: arXiv 论文超过同源上限
- **WHEN** 当日 arXiv 有 8 篇论文评分 >= 70
- **THEN** 保留评分最高的 5 篇标记为 auto，其余 3 篇降级为 skip

#### Scenario: review 区进入 LLM 选题
- **WHEN** 有 10 条新闻评分在 55-69 之间
- **THEN** 这 10 条全部进入 Phase 4 LLM 选题

### Requirement: 三级跨日去重

系统 SHALL 执行三级去重：Level 1 URL 精确匹配、Level 2 事件指纹匹配（Entity+EventType+Top3Keywords+DateBucket）、Level 3 标题 bigram 重叠度 >= 0.5。去重策略为 keep_highest_score。历史窗口 14 天。

#### Scenario: 同一 URL 去重
- **WHEN** 当日新闻 URL 与最近 14 天 curated.json 中某条 URL 完全相同
- **THEN** 当日新闻被标记为重复，不进入候选列表

#### Scenario: 同一事件不同来源不去重误杀
- **WHEN** 本周报道 "OpenAI 发布 GPT-5"，下周报道 "OpenAI 发布 GPT-5 API"
- **THEN** DateBucket 不同（不同周），不去重；TopKeywords 也不同（含"API"），进一步区分

#### Scenario: bigram 相似度去重
- **WHEN** 当日新闻标题 "DeepSeek正式发布V4系列模型" 与历史 "DeepSeek发布V4系列模型" bigram 重叠度 0.72
- **THEN** 判定为重复，保留评分更高的版本

### Requirement: normalize + filter

系统 SHALL 在评分前对原始数据做标准化处理：字段统一（source/sourceName→source_name）、去除 HTML 标签、URL 标准化（去尾部斜杠、统一协议）、时间格式统一为 ISO 8601。filter 阶段按时间窗口（RSS 默认 24h，学术源 48h）和关键词过滤（Tier 3 源必须匹配 AI_KEYWORDS）。

#### Scenario: 36kr 非 AI 新闻过滤
- **WHEN** 36kr 一条新闻标题为 "A股三大指数集体高开"，不包含任何 AI_KEYWORDS
- **THEN** 该条新闻被 filter 阶段淘汰，不进入评分

#### Scenario: arXiv 48h 时间窗口
- **WHEN** arXiv 论文发布时间距采集时间 30 小时（超过 24h 但在 48h 内）
- **THEN** 该论文不被时间窗口淘汰，但时效性评分降至 12-24h 档（5 分）
