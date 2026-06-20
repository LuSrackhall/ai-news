# AI 日报工作流 -- Claude Code 执行指令

本文件定义了 AI 领域日报自媒体的完整自动化工作流。
当用户说"采集今日 AI 新闻"或"生成今日日报"时，按本文件的 5 个阶段顺序执行。

---

## 工作流总览

```
Phase 1   多源并行采集
   1.1  RSS 源采集（5 个 agent 并行）
   1.2  WebSearch 搜索采集（5 个 agent 并行）
   1.3  WebFetch 直接抓取（2 个 agent 并行）
   ▼
   汇总 → rawItems[]
   ▼
Phase 2   交叉验证与事实核查（1 个 agent，串行）
   ▼
   verifiedItems[]
   ▼
Phase 3   质量评分与筛选（1 个 agent，串行）
   ▼
   selectedItems[]
   ▼
Phase 4   内容生成（2 个 agent 并行）
   4.1  日报文章 → article.md
   4.2  视频口播稿 → script.md
   ▼
Phase 5   元数据 + 索引更新
   ▼
   完成
```

---

## 输出目录约定

```
output/
├── <YYYY-MM-DD>/
│   ├── raw/                    # Phase 1 原始数据
│   │   ├── rss-huggingface.json
│   │   ├── rss-openai.json
│   │   ├── rss-google-ai.json
│   │   ├── rss-arxiv-cs-ai.json
│   │   ├── rss-mit-tech-review.json
│   │   ├── websearch-github-trending.json
│   │   ├── websearch-techcrunch-ai.json
│   │   ├── websearch-general-ai-news.json
│   │   ├── websearch-ai-product-launch.json
│   │   ├── websearch-ai-regulation.json
│   │   ├── webfetch-producthunt-ai.json
│   │   ├── webfetch-paperswithcode.json
│   │   ├── all-raw.json        # 汇总
│   │   └── failures.json       # 失败记录
│   ├── verified/
│   │   └── verified-news.json  # Phase 2 输出
│   ├── scored/
│   │   └── scored-news.json    # Phase 3 输出
│   ├── article.md              # Phase 4 输出
│   ├── script.md               # Phase 4 输出
│   └── manifest.json           # Phase 5 元数据
└── index.json                  # 全局历史索引
```

---

## Phase 1 -- 多源并行采集

**策略：12 个 agent 并行执行，互不依赖。**

### 1.1 RSS 源采集

对以下 5 个 RSS 源，每个启动一个独立 agent：

| ID | 名称 | URL |
|---|---|---|
| huggingface | Hugging Face Blog | `https://huggingface.co/blog/feed.xml` |
| openai | OpenAI Blog | `https://openai.com/blog/rss.xml` |
| google-ai | Google AI Blog | `https://blog.google/technology/ai/rss/` |
| arxiv-cs-ai | arXiv CS.AI | `http://export.arxiv.org/rss/cs.AI` |
| mit-tech-review | MIT Tech Review AI | `https://www.technologyreview.com/topic/artificial-intelligence/feed` |

每个 RSS agent 的执行步骤：
1. 使用 `WebFetch` 工具抓取 RSS feed URL
2. 从返回的 XML 内容中提取 `<item>` 条目
3. 过滤只保留 AI 相关条目
4. 生成中文摘要（100~300字）
5. 输出 JSON 数组

**RSS 采集 agent Prompt 模板**：

```
你是一个 RSS 新闻采集 agent。

## 任务
解析以下 RSS feed，提取 AI 相关新闻条目。

## Feed URL
{url}

## 来源
名称：{name} | ID：{id} | 分类：{category}

## 步骤
1. 用 WebFetch 抓取上面的 URL
2. 从 XML 中提取所有 <item> / <entry> 条目
3. 过滤：只保留标题或描述中包含 AI / 机器学习 / 大模型 / AGI / LLM / NLP / 计算机视觉 / 强化学习 相关关键词的条目
4. 对每条，提取 title / link / description / pubDate
5. 将 description 扩展为 100~300 字中文摘要
6. 生成 3~5 个关键词标签

## 输出格式（严格 JSON 数组，不要任何其他文字）
[
  {
    "id": "{id}_{前8位hash}",
    "source": "{id}",
    "title": "原文标题",
    "summary": "中文摘要（100~300字）",
    "url": "原文链接",
    "publishedAt": "ISO 8601 或 null",
    "collectedAt": "{当前ISO时间}",
    "category": "{category}",
    "tags": ["标签1", "标签2"],
    "method": "rss"
  }
]

## 约束
- 如果 WebFetch 失败或 feed 为空，返回空数组 []
- 不得编造 feed 中不存在的条目
- summary 必忠实于原文描述，不添加原文没有的信息
```

### 1.2 WebSearch 搜索采集

对以下 5 个搜索查询，每个启动一个独立 agent：

| ID | 查询 | 分类 |
|---|---|---|
| github-trending | `site:github.com trending AI machine learning today` | 开源项目 |
| techcrunch-ai | `site:techcrunch.com artificial intelligence latest news` | 行业新闻 |
| general-ai-news | `AI artificial intelligence breakthrough announcement today` | 综合新闻 |
| ai-product-launch | `AI product launch release announcement today` | 产品发布 |
| ai-regulation | `AI regulation policy government latest` | 政策监管 |

每个搜索 agent 的执行步骤：
1. 使用 `WebSearch` 工具执行查询
2. 从结果中取前 5~10 条
3. 对每条用 `WebFetch` 抓取正文生成摘要
4. 过滤只保留 48 小时内的新闻
5. 输出 JSON 数组

**搜索采集 agent Prompt 模板**：

```
你是一个 Web 搜索采集 agent。

## 任务
执行搜索查询，提取 AI 相关最新新闻。

## 搜索查询
"{query}"

## 分类标签
{category}

## 步骤
1. 使用 WebSearch 工具搜索上述查询
2. 从结果中筛选与 AI 直接相关的结果（前 5~10 条）
3. 对每条结果，使用 WebFetch 抓取页面正文
4. 从正文中提取 100~300 字中文摘要
5. 只保留 48 小时内发布的内容

## 输出格式（严格 JSON 数组，不要任何其他文字）
[
  {
    "id": "{id}_{前8位hash}",
    "source": "{id}",
    "title": "新闻标题",
    "summary": "中文摘要（100~300字）",
    "url": "原文链接",
    "publishedAt": "ISO 8601 或 null",
    "collectedAt": "{当前ISO时间}",
    "category": "{category}",
    "tags": ["标签1", "标签2"],
    "method": "websearch",
    "snippet_only": false
  }
]

## 约束
- WebSearch 返回空 → 返回空数组 []
- WebFetch 失败（403/超时）→ 用搜索结果的 snippet 作为 summary，设 snippet_only 为 true
- 不得编造搜索结果中没有的条目或细节
```

### 1.3 WebFetch 直接抓取

对以下 2 个目标页面，每个启动一个独立 agent：

| ID | URL | 分类 |
|---|---|---|
| producthunt-ai | `https://www.producthunt.com/topics/artificial-intelligence` | 产品发现 |
| paperswithcode | `https://paperswithcode.com/latest` | 学术论文 |

**抓取 agent Prompt 模板**：

```
你是一个 Web 抓取采集 agent。

## 任务
直接抓取目标页面，提取 AI 相关条目。

## 目标 URL
{url}
## 分类
{category}

## 步骤
1. 使用 WebFetch 工具抓取上述 URL
2. 从页面内容中提取 AI 相关的新闻/项目/论文条目
3. 每条生成 100~300 字中文摘要
4. 只保留最近 48 小时内的内容

## 输出格式（严格 JSON 数组）
[...同上格式，method 字段为 "webfetch"...]

## 约束
- WebFetch 失败 → 返回空数组 []
- 不得编造页面上不存在的内容
```

### Phase 1 汇总

所有 12 个 agent 完成后：
1. 将每个 agent 的输出写入 `output/<date>/raw/<sourceId>.json`
2. 合并所有结果到 `output/<date>/raw/all-raw.json`
3. 记录失败源到 `output/<date>/raw/failures.json`
4. 统计：`采集到 X 条原始数据，Y 个来源成功，Z 个失败`

---

## Phase 2 -- 交叉验证与事实核查

**策略：1 个 agent，串行执行（需要全局视角比对所有来源）。**

### 交叉验证 Prompt 模板

```
你是一个新闻事实核查 agent。你的任务是对采集到的新闻进行交叉验证。

## 输入数据
以下是来自 {N} 个来源的 {M} 条原始新闻（JSON 数组）：
{rawItems}

## 验证规则

### 规则 1：多源佐证
将标题相似的条目归为同一事件。同一事件被 2+ 个独立来源报道 → corroboratingCount >= 2 → "confirmed"。
只有 1 个来源的条目 → 需要进一步核查。

### 规则 2：WebSearch 补充核查
对只有 1 个来源的条目，执行 WebSearch：
  搜索查询："{title关键词} AI news"
  - 找到独立佐证 → "confirmed"
  - 找到部分佐证（内容有出入）→ "partial"
  - 完全找不到 → "unverified"

### 规则 3：反幻觉检测
以下特征降级为 "unverified" 或 "debunked"：
- 标题含"震惊""颠覆""史上最强"等夸张词且无实质佐证
- 摘要含无法验证的具体数字
- 发布时间超过 48 小时
- 原文链接无法访问

### 规则 4：来源合并
同一事件的多个来源，合并为一条，保留评分最高来源的详情，
其他来源记录在 corroboratingSources 中。

## 输出格式（严格 JSON 数组）
[
  {
    "id": "保留或新建的ID",
    "source": "主要来源ID",
    "title": "新闻标题",
    "summary": "合并后的最佳摘要",
    "url": "最佳来源链接",
    "publishedAt": "...",
    "collectedAt": "...",
    "category": "...",
    "tags": [...],
    "method": "...",
    "corroboratingSources": ["来源1", "来源2"],
    "corroboratingCount": 2,
    "verificationStatus": "confirmed | partial | unverified",
    "verificationNotes": "验证过程说明"
  }
]

## 约束
- "debunked" 的条目直接移除
- 不得编造佐证来源
- 如果原始数据不足 3 条，全部标记为 "unverified" 并说明原因
- 验证过程每一步都要在 verificationNotes 中记录
```

### 降级方案
- 如果 rawItems < 3 条：跳过验证，全部标记 "unverified"
- WebSearch 核查时搜索为空：标记 "unverified"（不丢弃）

---

## Phase 3 -- 质量评分与筛选

**策略：1 个 agent，串行执行（需要全局排名）。**

### 评分 Agent Prompt 模板

```
你是一个内容质量评分 agent。

## 输入数据
以下是经过交叉验证的 {N} 条新闻（JSON 数组）：
{verifiedItems}

## 评分维度（每项 0~10 整数）

### 新颖度 (noveltyScore)
- 10: 首次曝光的突破性成果
- 7~9: 较新进展，少量报道
- 4~6: 已知话题新角度
- 1~3: 旧闻重提
- 0: 完全过时

### 影响力 (impactScore)
- 10: 改变行业格局
- 7~9: 重要产品/融资/突破
- 4~6: 有意义的更新
- 1~3: 小众消息
- 0: 无影响

### 相关度 (relevanceScore)
- 10: AI 核心技术/产品
- 7~9: AI 强相关
- 4~6: 间接相关
- 1~3: 弱相关
- 0: 不相关（过滤掉）

### 综合评分计算
verificationMultiplier:
  confirmed → 1.0
  partial → 0.85
  unverified → 0.6

totalScore = round((noveltyScore * 0.3 + impactScore * 0.4 + relevanceScore * 0.3) * verificationMultiplier, 1)

### 分层
- totalScore >= 7.5 → tier: "must_include"
- totalScore >= 5.5 → tier: "include"
- totalScore >= 3.5 → tier: "optional"
- totalScore < 3.5 → tier: "skip"

## 输出格式（严格 JSON 数组，按 totalScore 降序）
[
  {
    ...所有原始字段...,
    "noveltyScore": 8,
    "impactScore": 7,
    "relevanceScore": 9,
    "totalScore": 7.8,
    "tier": "must_include",
    "scoringReason": "一句话评分理由"
  }
]

## 动态调整规则
1. must_include 不足 3 条 → 降低 include 阈值到 totalScore >= 4.5
2. 入选条目超过 12 条 → 只保留 top 12
3. scoringReason 必须简明扼要
```

---

## Phase 4 -- 内容生成

**策略：2 个 agent 并行（文章 + 口播稿互相独立）。**

### 4.1 日报文章 Agent

```
你是一个 AI 日报文章撰写 agent。

## 输入
筛选后的新闻条目（{N} 条）：
{selectedItems}

日期：{date}

## 文章结构

### 头部
# AI 日报 | {date}
> 一句话今日概览（捕捉当日最大主题）

### 分类板块
按 category 分组，每组一个二级标题：

## {分类名}

### {新闻标题}
{100~200字解读 -- 不是简单复述，要有分析：为什么重要、对行业意味什么}
> 来源：{source} | [原文链接]({url})

（每条新闻都要写）

### 编辑点评
100~200字总结当日趋势，提炼 1~2 个关键洞察。

### 尾部
---
*本日报由 AI 辅助采集与生成，新闻经多源交叉验证。*
*采集来源数：{N} | 验证通过数：{M} | 入选条目：{K}*

## 写作约束
- 中文，专业但不晦涩
- 客观理性有见地，不标题党
- 不得编造输入数据中没有的细节
- Markdown 格式
```

### 4.2 视频口播稿 Agent

```
你是一个视频口播稿撰写 agent。

## 输入
日报文章（Markdown）：
{article}

目标时长：3~5 分钟
平台：B站 / 抖音 / YouTube

## 口播稿结构

### 开场 [10~15s]
一个引人注目的问题或数据。

### 主体 [每条 30~60s]
按 totalScore 降序，对每条 must_include + include 新闻：
1. 一句话说清是什么
2. 一句话说清为什么重要
3. 有数据就口语化表达

### 收尾 [15~20s]
总结趋势 + 引导关注

## 写作约束
- 口语化，像跟朋友聊天
- 短句为主（一句不超 20 字）
- 数据口语化："涨了三倍" 不是 "提升了 300%"
- 每段前标注 [预估秒数]
- 不得编造新闻细节
```

---

## Phase 5 -- 元数据与索引更新

**纯本地操作，不需要 LLM。**

1. 写入 `output/<date>/manifest.json`：
   ```json
   {
     "date": "2026-06-20",
     "newsCount": 8,
     "categories": ["公司动态", "开源模型", "学术论文"],
     "sources": ["huggingface", "openai", "github-trending"],
     "failedSources": ["mit-tech-review"],
     "generatedAt": "ISO 8601",
     "version": "1.0.0"
   }
   ```

2. 更新 `output/index.json`：
   - 如果当天已存在 → 替换
   - 否则追加
   - 按日期降序排列

---

## 容错策略

### 重试规则
| 错误类型 | 重试次数 | 退避 |
|---|---|---|
| WebFetch 超时/500 | 3 次 | 1s → 3s → 8s |
| WebSearch rate limit | 3 次 | 2s → 5s → 10s |
| RSS 解析失败 | 2 次 | 1s → 3s |
| Agent 输出非法 JSON | 2 次 | 无退避，重新执行 |

### 降级方案
| 场景 | 降级措施 |
|---|---|
| RSS 源全部失败 | 依赖 WebSearch + WebFetch 结果 |
| WebFetch 抓取失败 | 使用搜索结果的 snippet 作为摘要 |
| 交叉验证时搜索为空 | 标记为 "unverified" 而非丢弃 |
| 最终条目不足 5 条 | 降低评分阈值到 totalScore >= 4.5 |
| 所有来源失败 | 报告错误，不生成空日报 |

### 反幻觉机制
1. **URL 必填**：所有条目必须带可验证的原文 URL
2. **数字限制**：摘要不得编造输入中没有的具体数字
3. **来源实名**：corroboratingSources 只能是实际搜索到的来源
4. **JSON 严格模式**：所有 agent 输出必须是合法 JSON，不允许自由文本
5. **人工审核入口**：生成 article.md 后，可选择暂停等待人工审核

---

## 定时执行方案

### 方案 A：系统 crontab（推荐）

```bash
# 每天早上 7:00 执行
0 7 * * * cd /Users/srackhalllu/safe-project/Ai-ribao && bash scripts/run-workflow.sh >> /tmp/ai-ribao.log 2>&1
```

### 方案 B：launchd（macOS 原生）

创建 `~/Library/LaunchAgents/com.ai-ribao.daily.plist`：
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.ai-ribao.daily</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>/Users/srackhalllu/safe-project/Ai-ribao/scripts/run-workflow.sh</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>7</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>/tmp/ai-ribao.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/ai-ribao-error.log</string>
</dict>
</plist>
```

### 方案 C：Claude Code CLI 直接调用

```bash
# 在 Claude Code 中直接执行完整工作流
claude "按照 .claude/ai-ribao-workflow.md 执行今天的 AI 日报采集和生成"
```

### 去重机制

每次执行前检查：
1. `output/<date>/article.md` 是否已存在 → 提示用户是否覆盖
2. 加载 `output/index.json` 中最近 7 天的记录
3. 新闻标题相似度（Jaccard 系数 > 0.6）→ 判定为重复
4. 相同 URL → 直接判定为重复
