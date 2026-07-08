# Output Quality Constitution

> 日报产出的最高层质量不变量。
> 所有 Agent 生成的日报必须遵守本文件。
> 修改本文件必须通过 Architecture Review + ADR。

---

## Preamble

本宪法定义 AI 日报产出的质量底线。它不定义"好的日报是什么样的"——那由编辑判断决定——它定义"什么绝对不能接受"。

违反本宪法的产出不得发布，即使验证脚本的 11 项格式检查全部通过。

---

## Invariant 1: Source Traceability

**每条新闻必须有可追溯的来源。**

Agent 在 article.json 中写入的每一条 `title` 和 `summary`，其事实内容必须源自 Step 1 从 SQLite 读取的事件数据。禁止：
- 编造 URL
- 编造 source_name
- 从标题自行推断正文内容（LLM 可以用自己的话总结，但不得补充不在原始数据中的事实）

**验证方式：** `node scripts/validate-output.mjs all` 检查 URL 存在性和来源字段完整。

---

## Invariant 2: Editorial Independence

**日报不是 RSS 聚合器，Agent 必须做编辑判断。**

禁止：
- 完全照搬单一信源的昨日头条作为自己的头条
- 同一来源连续占据 50% 以上的版面（除非当天该源确实垄断了报道）
- 跳过编辑观点（editorial 三件套是硬性要求）

**判断标准：** curated.json 中 source 的分布必须至少覆盖 3 个独立来源，36氪和虎嗅合计不超过 70%。

---

## Invariant 3: Narrative Coherence

**每期日报必须有清晰的叙事结构。**

速览段落应当用 1-2 句话概括当天主线，起到"读者在看详情前就知道今天有什么"的作用。深度报道应当展示因果链（发生了什么 → 为什么重要 → 这意味着什么）。编辑观点应当有自己的判断，而非复述新闻本身。

**具体约束：**
- `hook` 必须概括当天的>1 个核心事件
- `deep_items` 的 `content` 必须 >= 100 字，不能只是标题
- `editorial.judgment` 必须包含编辑自己的判断（"我认为/这意味着/接下来可能"），不能只是新闻摘要

---

## Invariant 4: No Fabrication

**禁止在 `source`、`sources`、`url` 字段中填写伪造数据。**

这是本宪法中最严格的不变量。所有 URL 必须来自 Step 1 的查询结果。所有 source_name 必须与 events.db 中的 source_name 一致。

**验证方式：** `node scripts/validate-output.mjs all` 的 URL 存在性检查。

---

## Invariant 5: Timeliness Relevance

**日报的核心价值在于"今天的新闻"。**

禁止使用已过 48 小时的事件作为主要报道（除非当天的新闻确实太少，作为 contextual rejection 的补充）。Ingestion 阶段的 `timeWindowHours: 48` 约束了采集窗口，但 Editoral 阶段不应进一步引入超出当日事件 pool 的历史内容。

---

## Invariant 6: Original Analysis

**深度报道不是摘要。**

`deep_items` 的 content 必须包含编辑的分析：因果链、对比、趋势判断，或至少一条具体数据。禁止仅将事件描述+URL 复制为"深度"，而不附加任何分析性内容。

**判断标准：** 一篇合格的 deep_item 应该让读者觉得"我看了这篇就不用看原文了"。

---

## Invariant 7: Measurable Baseline

**质量改进必须可量化。**

每次对系统（代码、prompt、配置）的修改，如果预期会影响产出质量，必须：
1. 在修改前跑 `node scripts/validate-output.mjs baseline`，确认当前基线
2. 在修改后重新生成全部日报（通过 agent 逐日生成）
3. 跑 `node scripts/validate-output.mjs compare`，产出差异报告

仅修复单点而不验证整体影响的做法不被接受。

---

## Invariant 8: Human Judgment Over Rules

**本宪法不替代编辑判断。**

宪法划定"绝对不能做什么"的底线。在此之上，质量提升需要编辑（人类或 Agent）的判断，而非机械规则。任何对本宪法的修改——包括新增不变量、调整阈值——必须经过完整的 Architecture Review + ADR 流程，和 Architecture Constitution 同级。
