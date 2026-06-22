# AI 日报 (ai-ribao)

自动化 AI 新闻日报系统，每日从 15+ 个信源采集、评分、去重、选题、生成高质量日报文章和视频口播稿。

## 架构

8 阶段 Pipeline 驱动：

```
RSS采集(代码) → URL验证(代码) → 评分去重(代码) → LLM选题 → LLM生成 → 渲染(代码) → 校验(代码) → 归档(代码)
   Phase 1       Phase 2        Phase 3       Phase 4   Phase 5    Phase 6     Phase 7     Phase 8
```

- Phase 1-3, 6-8: Node.js 确定性执行，零 LLM 成本
- Phase 4-5: LLM（Claude Sonnet）语义选题和内容生成
- LLM 输出 JSON，Renderer 渲染为 Markdown（支持多平台扩展）

## 快速开始

### 前置条件
- Node.js >= 18
- Claude Code（用于运行 Workflow）

### 生成今日日报

```bash
# 方式 1: 通过 Claude Code Workflow（推荐）
/ai-ribao-daily

# 方式 2: 指定日期
/ai-ribao-daily --date=2026-06-22

# 方式 3: 仅采集（Phase 1-2，不生成内容）
bash scripts/run-workflow.sh --date=2026-06-22
```

### 查看历史日报

```bash
bash scripts/run-workflow.sh --history
```

## 目录结构

```
ai-ribao/
├── .claude/workflows/
│   └── ai-ribao-daily.js     # Pipeline 主流程（Workflow）
├── scripts/
│   ├── config.mjs             # 全局配置（信源、评分、关键词）
│   ├── collect-rss.mjs        # Phase 1: RSS 采集
│   ├── verify-urls.mjs        # Phase 2: URL 验证
│   ├── score.mjs              # Phase 3: Base+Bonus 评分
│   ├── dedup.mjs              # Phase 3: 三级跨日去重
│   ├── render-article.mjs     # Phase 6: 文章渲染器
│   ├── render-script.mjs      # Phase 6: 口播稿渲染器
│   ├── validate-output.mjs    # Phase 7: 校验模块
│   ├── feedback.mjs           # 反馈数据采集
│   └── run-workflow.sh        # Shell 入口
├── prompts/
│   ├── v1/                    # Prompt 模板
│   │   ├── curation.md        # 选题 prompt
│   │   ├── article.md         # 文章生成 prompt
│   │   └── script.md          # 口播稿生成 prompt
│   └── examples/              # Few-shot 示例库
│       ├── good_editorials.json
│       └── good_hooks.json
├── data/
│   └── source-health.json     # 信源健康状态
├── output/
│   ├── <date>/
│   │   ├── raw/               # 原始采集数据
│   │   ├── candidates.json    # 评分+去重后的候选
│   │   ├── curated.json       # LLM 选题结果
│   │   ├── article.json       # LLM 输出（结构化）
│   │   ├── article.md         # 渲染后的文章
│   │   ├── script.json        # LLM 输出（结构化）
│   │   ├── script.md          # 渲染后的口播稿
│   │   ├── manifest.json      # 运行元数据
│   │   └── feedback.json      # 反馈数据
│   ├── index.json             # 历史日报索引
│   └── quality-trend.json     # 质量趋势数据
└── openspec/                  # 设计文档
```

## 信源管理

### 新增信源

编辑 `scripts/config.mjs` 的 `RSS_SOURCES` 数组：

```js
{
  id: 'new-source',
  name: '来源名称',
  url: 'https://example.com/rss',
  tier: 2,           // 1=官方, 2=权威媒体, 3=社区
  language: 'en',    // en 或 zh
  category: 'media', // official/academic/media/newsletter/community
  enabled: true,     // 是否启用
  status: 'active',  // active/probation/disabled
}
```

无需修改任何其他文件，采集脚本自动识别。

### 禁用信源

设置 `enabled: false`，或设置 `status: 'disabled'`。

### 信源健康监控

采集脚本自动追踪每个源的成功/失败状态，记录在 `data/source-health.json`。
连续失败 3 天告警，7 天建议禁用。

## 评分体系

### Base Score（四维，满分 65）

| 维度 | 满分 | 规则 |
|------|------|------|
| 权威性 | 20 | Tier1=20, Tier2=15, Tier3=7 |
| 时效性 | 15 | <1h=15, 1-3h=13, 3-6h=11, 6-12h=8, 12-24h=5 |
| 可验证性 | 15 | 官方链接=15, 多源=12, 单源=8 |
| 内容质量 | 15 | 含数字+4, 长摘要+3, 标题密度+5 |

### Bonus（可叠加，上限 35）

| 类型 | 分值 | 来源 |
|------|------|------|
| 实体权重 | 0-12 | OpenAI/Google/DeepSeek=10 |
| 事件类型 | 0-10 | 模型发布=10, 融资=8, 政策=7 |
| 量化信号 | 0-6 | 含金额/性能指标 |
| 学术信号 | 0-5 | 含热门话题/模型名 |

### 分级阈值

- auto >= 70: 自动入选
- review 55-69: LLM 复审
- skip < 55: 淘汰

### 同源上限

arXiv=5, TechCrunch=3, 36kr=3, 其他=3

## 去重策略

三级去重，14 天回溯窗口：

1. **URL 精确匹配** — 同一 URL 必定重复
2. **事件指纹** — Entity + EventType + Top3Keywords + WeekBucket
3. **标题 bigram 相似度** — 阈值 0.5

## 质量保障

- **事实锚定校验** — 检测文章中编造的数字
- **URL 交叉比对** — 检测编造的链接
- **文章-口播稿一致性** — 标题交集/并集 >= 50%
- **空洞表述检测** — "值得关注"等无信息量词语 <= 3 处
- **Schema 校验** — JSON 结构必须符合规范
- **信源健康追踪** — 连续失败自动告警

## 进化能力

### 反馈闭环

每期运行后自动生成 `feedback.json`，记录：
- LLM 选题保留率（selected / candidates）
- 评分-选题对齐率（auto 条目被选中比例）
- 实体级别入选统计
- 事件类型级别统计

全局 `quality-trend.json` 保留最近 60 天趋势数据。

### Prompt 模板化

Prompt 存储在 `prompts/v1/` 目录，支持：
- 版本化管理（v1, v2, ...）
- Few-shot 示例注入（`prompts/examples/`）
- 变量替换（`{{input_data}}`, `{{date}}`）

## 运维指南

### 常见问题

**Q: 某个 RSS 源持续 403**
A: 检查 `data/source-health.json` 的 failStreak。连续 3 天告警后，考虑设置 `enabled: false` 或更换 URL。

**Q: 日报质量下降**
A: 检查 `output/quality-trend.json` 的趋势。对比不同日期的 `feedback.json` 查看 entity_performance 变化。

**Q: 想新增一个中文 AI 媒体源**
A: 在 config.mjs 的 RSS_SOURCES 中添加，设置 `requireKeywordFilter: true`，并在 AI_KEYWORDS 中补充相关关键词。

**Q: 如何自定义 Prompt**
A: 编辑 `prompts/v1/` 下的模板文件。新增示例到 `prompts/examples/`。修改后递增 config.mjs 中的 PROMPT_VERSION。

## 测试

```bash
# 运行模块单元测试（23 个测试）
node scripts/test-modules.mjs

# 运行完整采集测试（Phase 1-2）
node scripts/collect-rss.mjs --date=2026-06-22
node scripts/verify-urls.mjs --date=2026-06-22
```

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v3 | 2026-06-22 | Pipeline 重构：8 阶段混合架构，Base+Bonus 评分，三级去重，JSON→Renderer |
| v2 | 2026-06-20 | Agent Workflow：6 阶段 LLM 驱动 |
