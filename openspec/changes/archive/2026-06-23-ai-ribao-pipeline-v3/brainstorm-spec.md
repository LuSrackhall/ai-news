# AI 日报工程重建 — 设计文档

> Pipeline v3: 从 Agent Workflow 到生产级内容流水线

## Context

AI 日报系统（ai-ribao）当前存在 6 个已确认问题：

| 问题 | 严重性 | 根因 |
|------|--------|------|
| 文章/脚本内容互换 | 高 | Phase 5 的 `parallel()` 返回顺序不确定 |
| LLM 推理泄漏到产出文件 | 高 | 归档 agent 不做清洗直接写文件 |
| 跨日重复内容 | 高 | index.json 从未生成，去重从未执行 |
| arXiv 论文全部同分（82分） | 中 | 5 维中 4 维是 tier 查表常量 |
| 死链残留 | 中 | URL 验证在精选之后，浪费名额 |
| 36kr 噪音过高 | 低 | 全站 feed，AI 内容占比不足 20% |

系统需要从「LLM agent 自由发挥」转变为「代码驱动的确定性 Pipeline」，支撑长期每日运行。

## Goals / Non-Goals

**Goals:**
- 每次执行产出格式完全一致（JSON Schema + Renderer 双保险）
- 消除跨日重复内容（事件指纹 + 日期 bucket）
- 评分有区分度（Base Score + Bonus 分层，可扩展）
- 单源/单 URL 异常不导致整条流水线失败（错误分级）
- LLM 输出可测试、可多平台渲染（JSON → Renderer）
- 每次运行有完整可追溯的 manifest（含版本、哈希、耗时）
- Phase 职责边界清晰，长期维护不模糊

**Non-Goals:**
- 不引入付费第三方 API（如 Semantic Scholar）
- 不改变输出目录的整体结构
- 不做自动发布（保持人工审核环节）
- 不追求完全消除 LLM（语义选题和内容生成仍需要 LLM）

## Decisions

### D1：8 阶段 Pipeline 驱动架构

```
Phase 1  采集 (Node.js)          → raw.json
Phase 2  URL 验证 (Node.js)      → 移除死链 → valid_raw.json
Phase 3  确定性处理 (Node.js)     → normalize + filter + score + dedup → candidates.json
Phase 4  LLM 语义选题 (Sonnet)   → curated.json
Phase 5  LLM 内容生成 (Sonnet, 串行) → article.json + script.json
Phase 6  渲染+格式化 (Node.js)   → article.md + script.md
Phase 7  校验 (Node.js)          → Schema + 内容质量检查
Phase 8  归档 (Node.js)          → 写入文件 + 更新 index.json + manifest.json
```

**关键架构决策：**

- **Phase 2 URL 验证前置**：死链在采集后立即淘汰，不进入评分。坏链接没有评分价值。
- **Phase 3 命名为「确定性处理」**：涵盖 normalize + filter + score + dedup，以后加入 HTML 清洗、语言检测等无需改名。
- **Phase 4 只负责 Curation，不允许改写事实**：LLM 只能决定「选什么、排什么、分到重磅还是快讯」，不能修改 title、source、url、published_at 等原始字段。Curation 不是 Rewrite。
- **Phase 5 串行执行**：先生成 article.json，再基于文章生成 script.json。消除 parallel() 的内容互换 bug，同时保证口播稿与文章一致性。
- **Phase 5 LLM 输出结构化 JSON（非 Markdown）**：格式永远一致，可测试，未来支持多平台渲染。
- **Phase 6 Renderer = Formatter + Template**：不仅做模板渲染，还承担统一格式化（Markdown Escape、URL Encode、时间格式、中文标点、引号统一、空行规范）。让 LLM 的 prompt 可以更自由。
- **Phase 8 归档全部代码实现**：不用 LLM agent 写文件，消除推理泄漏和写入错误。
- **所有中间产物包含 pipeline_version 字段**：支持版本兼容追溯。

### D2：错误分级（Fatal / Recoverable）

```
Fatal（立即终止，返回 status: "fatal"）：
  - raw.json 为空（Phase 1 无数据）
  - candidates.json 为空（Phase 3 全部淘汰）
  - curated.json 为空（Phase 4 LLM 未选中任何条目）
  - article.json 或 script.json 为空（Phase 5 生成失败且重试仍失败）

Recoverable（降级继续）：
  - 单个 RSS 源超时/403 → 跳过该源，记录到 manifest.failures
  - 单条 URL 404 → 移除该条，记录到 manifest
  - 有效条目 < target_min → 降低评分阈值重试一次
  - Schema 校验失败 → 重试 LLM 生成一次
  - 内容校验不通过（空洞表述等）→ 写入但 manifest 标记 validation_passed: false
```

**原则：** 生成内容的 agent 失败可以重试，数据操作失败应降级为确定性代码执行。单源异常（RSS 403、URL 404）绝不阻塞全局。

### D3：Manifest + 版本管理

每次运行生成完整的 manifest.json，包含：

```json
{
  "date": "2026-06-22",
  "pipeline_version": "v3",
  "prompt_version": "v1",
  "renderer_version": "v1",
  "schema_version": "v1",
  "llm_model": "claude-sonnet",
  "sources": {
    "total": 20,
    "succeeded": 18,
    "failed": ["openai: HTTP 403"]
  },
  "pipeline": {
    "collect": { "raw_count": 85, "duration_s": 18 },
    "url_verify": { "checked": 85, "valid": 78, "removed": 7, "duration_s": 12 },
    "deterministic": { "input": 78, "candidates": 34, "auto": 12, "review": 22, "duration_s": 3 },
    "curate": { "input": 34, "selected": 10, "duration_s": 28 },
    "generate": {
      "article_ok": true, "script_ok": true,
      "retry_count": 0, "duration_s": 55
    },
    "render": { "article_chars": 3200, "script_chars": 4500 },
    "validate": {
      "article_passed": true, "script_passed": true,
      "checks": ["schema:pass", "no_leak:pass", "urls:pass", "structure:pass"]
    }
  },
  "quality": {
    "dead_link_count": 0,
    "reasoning_leak_detected": false,
    "hallucinated_url_count": 0,
    "dedup_overlap_count": 2
  },
  "input_hashes": {
    "raw": "sha256:...",
    "candidates": "sha256:...",
    "curated": "sha256:..."
  },
  "output_hashes": {
    "article": "sha256:...",
    "script": "sha256:..."
  },
  "duration_total_s": 120
}
```

**版本字段用途：** 日报质量下降时，通过 pipeline/prompt/renderer/schema 四个版本号快速定位问题来源。input_hashes 支持完整复现。

### D4：评分算法 — Base Score + Bonus 分层

**Base Score（四维，代码计算，满分 65）：**

| 维度 | 满分 | 规则 |
|------|------|------|
| 权威性 | 20 | Tier1=20, Tier2=15, Tier3=7; 学术源跨分类出现在 cs.AI+cs.CL 时 +3 |
| 时效性 | 15 | <1h=15, 1-3h=13, 3-6h=11, 6-12h=8, 12-24h=5, >24h=2 |
| 可验证性 | 15 | 官方链接=15, 多源佐证=12, 单源有摘要=8, 单源无摘要=4 |
| 内容质量 | 15 | 含具体数字+4, 摘要>100字+3, 标题信息密度（含模型名/公司名/动词）+5 |

**Bonus（可叠加，上限 35 分）：**

| Bonus 类型 | 分值 | 规则 |
|-----------|------|------|
| 实体权重 | 0-12 | config.mjs 实体表：OpenAI/Google/DeepSeek=10, HF/百度=6, 其他=3; 多顶级实体+2 |
| 事件类型 | 0-12 | config.mjs 事件表：模型发布=10, 融资>1亿=8, 政策=7, 人才变动=5, 学术论文=3 |
| 量化信号 | 0-6 | 正则匹配：含金额+2, 含性能指标+1, 含规模指标+1 |
| 学术信号 | 0-5 | 标题含热门话题/知名模型名/SOTA 关键词 |

**Final Score = min(Base + Bonus, 100)**

**阈值：** auto >= 70, review 55-69, skip < 55

**同源上限：** arXiv = 5, TechCrunch = 3, 36kr = 3, 其他 = 3

**设计理由：** Base 和 Bonus 分离后，未来新增 Bonus 类型（GitHub Stars、Twitter 趋势、Reddit 热度等）只需在 config.mjs 加配置，不改 Base 计算逻辑。

**预期区分度验证：**

| 条目 | 权威性 | 时效性 | 可验证性 | 内容质量 | 实体 | 事件 | 量化 | 总分 |
|------|--------|--------|---------|---------|------|------|------|------|
| DeepSeek-V4 (arXiv) | 23 | 8 | 15 | 12 | 10 | 10 | 0 | 78 (auto) |
| Hidden Anchors (arXiv) | 20 | 8 | 15 | 6 | 0 | 3 | 0 | 52 (skip) |
| Baseten 融资 (TC) | 15 | 13 | 12 | 7 | 6 | 8 | 2 | 63 (review) |
| 挪威 AI 禁令 (36kr) | 15 | 5 | 8 | 3 | 0 | 7 | 0 | 38 (skip) |

### D5：三级跨日去重（事件指纹 + DateBucket）

```
Level 1: URL 精确匹配 → 直接去重
Level 2: 事件指纹匹配 → 去重
Level 3: 标题 bigram 重叠度 >= 0.5 → 去重
```

**事件指纹格式：**
```
{Entity}|{EventType}|{TopKeywords}|{YYYY-WXX}

示例:
OpenAI|model_release|GPT-5,API,发布|2026-W25
DeepSeek|model_release|V4,百万token,稀疏注意力|2026-W25
John Jumper|talent_movement|Anthropic,DeepMind,诺贝尔|2026-W25
```

**关键设计：**
- DateBucket 使用 ISO 周编号 `YYYY-WXX`
- **TopKeywords 保留前 3 个关键词**（不少于 3），避免 GPT-5 vs GPT-5 API 被误杀
- 同一实体+同一事件类型+同一周 → 判定为同一事件，保留评分更高的条目
- 跨周的同实体同事件不去重（OpenAI 发布 GPT-X → 一周后发布 GPT-X API 是不同新闻）
- 去重策略：`keep_highest_score`
- 历史窗口：14 天

### D6：LLM 输出 JSON → Renderer 生成 Markdown

**Phase 4 输出结构（curated.json）：**

```json
{
  "date": "2026-06-22",
  "pipeline_version": "v3",
  "selected_items": [
    {
      "id": "原始ID（不可修改）",
      "title": "原始标题（不可修改）",
      "url": "原始URL（不可修改）",
      "source_name": "原始来源（不可修改）",
      "published_at": "原始时间（不可修改）",
      "summary_zh": "原始摘要（不可修改）",
      "category": "分类",
      "importance": "deep / important / brief",
      "curation_note": "选入理由"
    }
  ],
  "curation_summary": {
    "total_selected": 10,
    "deep_count": 2,
    "important_count": 4,
    "brief_count": 4,
    "categories_covered": ["模型发布", "研究突破"],
    "sources_used": ["arXiv", "TechCrunch"],
    "dropped_reasons": "简述去除原因"
  }
}
```

**Phase 4 边界约束：** Phase 4 只决定 `importance`（deep/important/brief）和 `curation_note`，不允许修改 title、url、source_name、published_at、summary_zh 等事实字段。Curation 不是 Rewrite。

**Phase 5 输出结构：**

```json
// article.json
{
  "hook": "DeepSeek 甩出 1.6 万亿参数，诺贝尔奖得主却转投对手...",
  "summary_items": [
    { "title": "DeepSeek-V4 系列发布", "one_liner": "1.6T参数，百万token上下文" }
  ],
  "deep_items": [
    {
      "title": "DeepSeek 发布 V4 系列",
      "what_happened": "1-2 句话事实陈述",
      "details": "技术/商业细节，必须含具体数字",
      "why_matters": "对行业格局的具体影响",
      "implications": "趋势判断 + 预测",
      "sources": [{ "name": "arXiv", "url": "https://..." }]
    }
  ],
  "important_items": [
    {
      "title": "...",
      "key_point": "一句话核心事实",
      "analysis": "为什么值得关注，含对比数字或直接影响",
      "source": { "name": "...", "url": "..." }
    }
  ],
  "brief_items": [
    { "title": "...", "fact": "一句话纯事实", "source": "..." }
  ],
  "editorial": {
    "observation": "今天新闻中呈现出的模式或矛盾",
    "evidence": "引用今天具体新闻中的事实作为支撑",
    "judgment": "一个明确的、可被反驳的立场",
    "prediction": "基于判断，未来 3-6 个月可能发生什么"
  }
}

// script.json
{
  "hook": { "text": "冲突/数据冲击开场", "duration_s": 18 },
  "overview": { "text": "数字概括", "duration_s": 16 },
  "deep_items": [
    { "title": "...", "text": "详细展开", "duration_s": 45 }
  ],
  "quick_items": [
    { "title": "...", "text": "是什么+一句话为什么重要", "duration_s": 18 }
  ],
  "closing": { "text": "趋势提炼+前瞻判断", "duration_s": 17 }
}
```

**Phase 6 Renderer = Formatter + Template：**

Renderer 不仅做模板渲染，还承担统一格式化：
- Markdown Escape（特殊字符转义）
- URL Encode（确保链接可点击）
- 时间格式统一（ISO 8601 → 中文可读格式）
- 中文标点规范化（半角→全角）
- 引号统一（英文引号→中文引号，按上下文判断）
- 空行规范化（连续空行合并）
- 列表排序（按 importance 和评分降序）

Renderer 版本独立管理（renderer_version），模板调整不需修改 LLM prompt。

**多平台扩展路径：**
```
同一份 article.json
  → render-article.mjs     → article.md (Markdown)
  → render-wechat.mjs      → 微信公众号 HTML
  → render-rss.mjs         → RSS feed
  → render-email.mjs       → 邮件模板
  → render-web.mjs         → 网页 JSON API
```

### D7：Schema Validation（Phase 7）

**LLM JSON 输出的 Schema 定义（区分 Required 和 Optional）：**

article.json:
```
required:
  - hook (string, 非空)
  - summary_items (array, 1-8 items, 每个含 title + one_liner)
  - editorial (object, 含 observation + evidence + judgment + prediction)

optional:
  - deep_items (array, 0-3 items, 每个含 title + what_happened + details + why_matters + implications + sources)
  - important_items (array, 0-6 items, 每个含 title + key_point + analysis + source)
  - brief_items (array, 0-8 items, 每个含 title + fact + source)
```

script.json:
```
required:
  - hook (object, 含 text + duration_s)
  - overview (object, 含 text + duration_s)
  - closing (object, 含 text + duration_s)

optional:
  - deep_items (array, 0-3 items)
  - quick_items (array, 0-8 items)
```

**内容质量校验（Schema 通过后执行）：**
1. URL 均存在于 curated.json（防编造链接）
2. 无空洞表述（"值得关注""意义深远""引发热议" 超过 3 处 → FAIL）
3. 口播稿 duration_s 总和在 180-300s
4. editorial 四个字段均非空且长度 > 30 字
5. deep_items 的 details 字段包含至少 1 个数字

Schema 校验失败 → 重试 LLM 一次 → 仍失败 → Fatal 终止
内容校验不通过 → 写入但 manifest 标记 validation_passed: false

### D8：推理泄漏防御

**JSON 输出天然防御：** LLM 输出 JSON 而非 Markdown，推理前缀（"让我分析"）会导致 JSON 解析失败，自动触发重试。

**JSON 解析兜底：** 如果 LLM 返回的文本不是合法 JSON（包含推理前缀），尝试截取第一个 `{` 到最后一个 `}` 之间的内容再解析。

**Prompt 约束（第一层）：** 生成 prompt 中明确：
```
## 输出规则（最高优先级）
1. 直接输出合法 JSON，禁止输出任何非 JSON 内容
2. 输出的第一个字符必须是 {
3. 输出的最后一个字符必须是 }
4. 禁止在 JSON 前后添加任何说明、分析、确认语句
```

### D9：内容生成 Prompt — 描述风格而非对标媒体

Prompt 中不引用"机器之心""量子位"等具体媒体名，改为描述风格要求：

```
风格要求：
- 信息密度高，每段聚焦一个核心观点
- 使用具体数字支撑结论（参数量、融资额、准确率等）
- 技术与产业分析并重
- 避免营销语言和空泛表述
- 每条分析必须回答"为什么重要"和"这意味着什么"
- 禁止使用"值得关注""意义深远""引发热议"等无信息量表述
```

**写作硬约束：**
1. 禁止编造：输入数据中没有的数字、公司名、人名、事件不得出现
2. 禁止思维链：输出必须是合法 JSON
3. 数据锚定：deep_items 和 important_items 必须包含至少 1 个具体数字
4. 来源实名：sources 中的 name 必须是 curated.json 中实际存在的来源
5. 字数约束：deep_items details 200-400 字, important_items analysis 80-150 字, brief_items fact 30-50 字

### D10：数据源扩展

**P0 修复：** OpenAI RSS `.rss` → `.rss.xml`

**现有源切换到 AI 专题 feed（减少 80%+ 噪音）：**
- TechCrunch: `/feed/` → `/category/artificial-intelligence/feed/`
- MIT Tech Review: `/feed/` → `/topic/artificial-intelligence/feed`
- The Verge: `/rss/index.xml` → `/rss/ai-artificial-intelligence/index.xml`

**新增 Tier 1：** DeepMind (`deepmind.google/blog/rss.xml`), Microsoft Research（需关键词过滤）, NVIDIA（需关键词过滤）

**新增 Tier 2：** VentureBeat AI, Ars Technica AI, Import AI (Substack), The Batch

**36氪处理：** 保持 Tier 2，补充中国 AI 公司关键词（百度、文心、通义、千问、豆包、Kimi、智谱、百川、月之暗面、MiniMax、零一万物、商汤、科大讯飞、寒武纪、Qwen、DeepSeek、ChatGPT、Copilot）

**WebSearch 补充（6 个查询，覆盖无 RSS 的官方源）：**
- Anthropic/Claude 动态
- Meta AI / Llama 动态
- Google AI / Gemini 动态
- Hugging Face 社区
- Mistral AI 更新
- 中文 AI 媒体覆盖

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| JSON Renderer 增加初始开发量 | 一次性投入，后续模板调整零 LLM 成本且不影响 Prompt |
| 事件指纹 DateBucket 可能误杀月末跨周新闻 | TopKeywords 保留 3 个提供区分（GPT-5 vs GPT-5 API 关键词不同） |
| 14 天去重窗口 + 事件指纹可能过于保守 | 保守好过重复；可通过 manifest 的 dedup_overlap_count 监控误杀率 |
| WebSearch 增加 LLM 调用次数 | 6 个查询共 1 个 agent 调用，成本可控 |
| 评分 Base+Bonus 分层增加理解成本 | config.mjs 中集中管理，有注释，且 Base 和 Bonus 边界清晰 |
| Phase 4 不允许改写事实可能限制 LLM 灵活性 | 这是有意的约束——事实准确性 > 表达灵活性 |
| Renderer 格式化规则可能过于严格 | 规则在 Formatter 代码中集中管理，可快速调整 |

## 实施优先级

### P0（本轮实施）

| # | 改动 | 工作量 | 影响 |
|---|------|--------|------|
| 1 | Phase 6 从 agent 改为代码写文件 | 小 | 消除内容互换 bug |
| 2 | Phase 4 串行执行 | 小 | 消除内容互换 bug |
| 3 | 推理泄漏防御（JSON 输出 + 解析兜底） | 小 | 消除输出污染 |
| 4 | Manifest + Pipeline Version + 四版本号 | 中 | 完整可追溯 |
| 5 | URL 验证前置到 Phase 2 | 中 | 死链不浪费名额 |
| 6 | 错误分级（Fatal/Recoverable） | 中 | 单源异常不阻塞全局 |

### P1（下一轮迭代）

| # | 改动 | 工作量 |
|---|------|--------|
| 7 | LLM 输出 JSON + Renderer（Formatter+Template） | 大 |
| 8 | Schema Validation（Required/Optional） | 中 |
| 9 | Base Score + Bonus 评分分层 | 中 |
| 10 | 三级跨日去重（事件指纹 + DateBucket + Top3 Keywords） | 中 |
| 11 | 36氪关键词过滤 | 小 |

### P2（未来可选）

| # | 改动 | 工作量 |
|---|------|--------|
| 12 | 数据源扩展（DeepMind, VentureBeat 等） | 小 |
| 13 | 内容 Prompt 风格化优化 | 小 |
| 14 | WebSearch 补充策略 | 中 |
| 15 | 趋势分析能力 | 大 |
| 16 | input_hashes 支持完整复现 | 小 |
