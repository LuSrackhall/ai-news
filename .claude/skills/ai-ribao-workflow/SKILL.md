---
name: ai-ribao-workflow
description: AI 领域日报自媒体自动化工作流。用户说"采集今日 AI 新闻"或"生成今日日报"时触发。5 阶段 pipeline：多源并行采集 → 交叉验证 → 质量评分 → 内容生成（文章 + 口播稿）→ 元数据索引。内含 12 个并行采集 agent、容错重试、反幻觉机制、历史去重。
---

# AI 日报工作流

自动化采集 AI 领域新闻，经交叉验证和质量评分后，生成日报文章和视频口播稿。

## 触发条件

用户说以下任意一句时触发本工作流：
- "采集今日 AI 新闻"
- "生成今日日报"
- "做一期 AI 日报"
- "今天的 AI 新闻"
- "run ai daily"

## 工作流总览

```
Phase 1   多源并行采集（12 个 agent 并行）
   ├── 5 个 RSS 源 agent
   ├── 5 个 WebSearch agent
   └── 2 个 WebFetch agent
   ▼
   rawItems[] → 写入 output/<date>/raw/
   ▼
Phase 2   交叉验证（1 个 agent）
   ▼
   verifiedItems[] → 写入 output/<date>/verified/
   ▼
Phase 3   质量评分（1 个 agent）
   ▼
   selectedItems[] → 写入 output/<date>/scored/
   ▼
Phase 4   内容生成（2 个 agent 并行）
   ├── 日报文章 → article.md
   └── 口播稿 → script.md
   ▼
Phase 5   元数据 + 索引更新
```

## 执行方式

### 方式 1：手动在 Claude Code 中执行

直接在对话中说"执行今天的 AI 日报"，agent 会按 `.claude/ai-ribao-workflow.md` 中定义的 5 个阶段顺序执行。

### 方式 2：脚本执行

```bash
bash scripts/run-workflow.sh                    # 今天
bash scripts/run-workflow.sh --date=2026-06-20  # 指定日期
bash scripts/run-workflow.sh --dry-run           # 只采集不生成
bash scripts/run-workflow.sh --history           # 查看历史
```

### 方式 3：定时执行

```bash
# 添加 crontab
crontab -e
# 每天 7:00 执行
0 7 * * * cd /Users/srackhalllu/safe-project/Ai-ribao && bash scripts/run-workflow.sh
```

## Phase 1 详细说明：多源并行采集

### 数据源分类

**A 类 -- RSS 源**（通过 WebFetch 抓取 XML）：

| ID | 来源 | 侧重 |
|---|---|---|
| huggingface | Hugging Face Blog | 开源模型发布、技术博客 |
| openai | OpenAI Blog | GPT/ChatGPT 更新、公司动态 |
| google-ai | Google AI Blog | Gemini、Google AI 产品 |
| arxiv-cs-ai | arXiv CS.AI | 学术论文、前沿研究 |
| mit-tech-review | MIT Tech Review | 行业分析、深度报道 |

**B 类 -- WebSearch 动态搜索**：

| ID | 查询 | 侧重 |
|---|---|---|
| github-trending | `site:github.com trending AI machine learning` | 开源项目热度 |
| techcrunch-ai | `site:techcrunch.com AI latest` | 行业新闻 |
| general-ai-news | `AI breakthrough announcement today` | 综合新闻 |
| ai-product-launch | `AI product launch release` | 产品发布 |
| ai-regulation | `AI regulation policy government` | 政策法规 |

**C 类 -- WebFetch 直接抓取**：

| ID | URL | 侧重 |
|---|---|---|
| producthunt-ai | Product Hunt AI 专题 | 新产品发现 |
| paperswithcode | Papers With Code | 论文+代码 |

### 并行策略

12 个 agent 互不依赖，全部并行。单个 agent 超时 30 秒，失败不影响其他。

### 工具选择策略

| 场景 | 工具 | 理由 |
|---|---|---|
| RSS feed 解析 | WebFetch | feed URL 已知，直接抓取 |
| 搜索最新新闻 | WebSearch | 需要搜索引擎能力 |
| 抓取页面正文 | WebFetch | URL 已知，提取正文 |
| RSS 解析（备用） | Bash + curl | WebFetch 超时时降级 |

## Phase 2 详细说明：交叉验证

### 验证流程

1. **标题聚类**：将标题相似的条目归为同一事件
2. **多源计数**：同一事件的独立来源数 = corroboratingCount
3. **搜索补查**：对单源条目，WebSearch 补充验证
4. **反幻觉检测**：检查夸张词汇、无法验证的数字、超时新闻

### 验证状态

| 状态 | 条件 | 后续处理 |
|---|---|---|
| confirmed | 2+ 独立来源佐证 | 评分系数 1.0 |
| partial | 内容有出入的佐证 | 评分系数 0.85 |
| unverified | 找不到佐证 | 评分系数 0.6，保留但降权 |
| debunked | 信息明显错误 | 直接移除 |

## Phase 3 详细说明：质量评分

### 评分公式

```
totalScore = (novelty * 0.3 + impact * 0.4 + relevance * 0.3) * verificationMultiplier
```

### 分层标准

| 层级 | 阈值 | 含义 |
|---|---|---|
| must_include | >= 7.5 | 硬新闻，必须入选 |
| include | >= 5.5 | 好新闻，建议入选 |
| optional | >= 3.5 | 可选，新闻少时补上 |
| skip | < 3.5 | 不入选 |

### 动态调整

- must_include < 3 条：降低 include 阈值到 4.5
- 入选 > 12 条：截断保留 top 12

## Phase 4 详细说明：内容生成

### 日报文章结构

```
# AI 日报 | {date}
> 今日概览

## {分类 1}
### {标题}
{解读}
> 来源 | 链接

## {分类 2}
...

## 编辑点评
{趋势分析}

---
*采集说明*
```

### 口播稿结构

```
[10~15s] 开场 Hook
[30~60s] 新闻 1（口语化解读）
[30~60s] 新闻 2
...
[15~20s] 收尾 + 引导关注
```

## 输出目录

```
output/
├── <date>/
│   ├── raw/              # 每个来源一个 JSON + all-raw.json
│   ├── verified/         # verified-news.json
│   ├── scored/           # scored-news.json
│   ├── article.md        # 日报文章
│   ├── script.md         # 口播稿
│   └── manifest.json     # 元数据
└── index.json            # 历史索引
```

## 容错与质量保障

### 重试策略
- WebFetch/搜索失败：最多重试 3 次，指数退避（1s/3s/8s）
- Agent 输出非法 JSON：重试 2 次，重新执行

### 降级方案
- RSS 全挂 → 依赖 WebSearch
- WebFetch 失败 → 用搜索 snippet
- 验证搜索为空 → 标记 unverified
- 条目不足 5 条 → 降低评分阈值

### 反幻觉机制
- 所有条目必须带原文 URL
- 不得编造输入中没有的数字
- 佐证来源必须是实际搜索到的
- 输出必须是合法 JSON

## 历史去重

- 加载 index.json 最近 7 天记录
- 标题 Jaccard 相似度 > 0.6 → 重复
- 相同 URL → 重复
- 当天已存在 → 提示是否覆盖

## 相关文件

| 文件 | 用途 |
|---|---|
| `.claude/ai-ribao-workflow.md` | 完整执行指令（agent 必读） |
| `scripts/run-workflow.sh` | Shell 入口脚本 |
| `scripts/pipeline-runner.mjs` | Pipeline 蓝图 + Schema + Prompt 模板 |
| `output/` | 所有输出目录 |
