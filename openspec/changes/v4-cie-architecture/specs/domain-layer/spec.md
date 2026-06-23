## ADDED Requirements

### Requirement: ranking domain SHALL score assets and classify by tier

合并 v3 的 `score.mjs` + `collect-rss.mjs` 的 `computeImpactScore`，提供 `scoreAll`、`classify`、`buildEvents` 方法。评分逻辑只有一个权威来源。

#### Scenario: 批量评分
- **WHEN** ScorePhase 调用 `ctx.domain.ranking.scoreAll(assets)`
- **THEN** 返回每个 Asset 附带 `rank` 快照（baseScore/bonusScore/totalScore/tierLabel/factors），评分结果与 v3 的 `scoreAll()` 输出一致

#### Scenario: 分级
- **WHEN** 调用 `ctx.domain.ranking.classify(scoredAssets)`
- **THEN** 返回 `{ auto: [...], review: [...], skip: [...] }`，分级阈值与 v3 一致（auto >= 70, review 55-69, skip < 55）

#### Scenario: 构建 Event
- **WHEN** 调用 `ctx.domain.ranking.buildEvents(scoredAssets)`
- **THEN** 返回 Event[]，每个 Event 的 `rank` 字段为该 Asset 的评分快照，`contentHash` 继承自 Asset

### Requirement: dedup domain SHALL perform three-level dedup

去重策略继承 v3：Level 1 URL 精确匹配、Level 2 事件指纹、Level 3 标题 bigram 相似度。通过 `ctx.stores.events.history(14)` 获取历史数据。

#### Scenario: URL 精确去重
- **WHEN** 两个 Event 的 url 完全相同
- **THEN** 保留 totalScore 较高的 Event，另一个移入 removed

#### Scenario: 事件指纹去重
- **WHEN** 两个 Event 的 `{Entity}|{EventType}|{Top3Keywords}|{YYYY-WXX}` 指纹相同
- **THEN** 保留 totalScore 较高的 Event

#### Scenario: 标题相似度去重
- **WHEN** 两个 Event 的标题 bigram 相似度 >= 0.5
- **THEN** 保留 totalScore 较高的 Event

#### Scenario: 与 14 天历史去重
- **WHEN** 当前 Event 与历史 Event 在任一级别匹配
- **THEN** 当前 Event 被移除（历史优先）

### Requirement: curation domain SHALL orchestrate LLM selection

从 workflow Phase 4 提取，封装 prompt 加载 + agent 调用 + 结果校验。

#### Scenario: LLM 选题
- **WHEN** CuratePhase 调用 `ctx.domain.curation.select(candidates)`
- **THEN** 加载 `prompts/v1/curation.md`，调用 `ctx.services.agent.generate(prompt, CURATION_SCHEMA)`，返回 `{ curatedEvents, summary }`，curatedEvents 中每个 Event 的 `curation` 快照已填充

#### Scenario: 选题结果为空
- **WHEN** LLM 返回空的 selected_items
- **THEN** 返回 `{ curatedEvents: [], summary: { ... } }`，不抛异常（由 Phase 判断是否 fatal）

### Requirement: generate domain SHALL orchestrate LLM content generation

从 workflow Phase 5 提取，封装 prompt 加载 + agent 调用 + JSON 解析兜底 + 重试。返回 `{ content, meta }` 结构，meta 包含 eventIds/model/promptVersion/inputHash/retryCount。

#### Scenario: 文章生成成功
- **WHEN** GenerateArticlePhase 调用 `ctx.domain.generate.article()`
- **THEN** 返回 `{ content: { hook, summaryItems, ... }, meta: { eventIds, model, promptVersion, inputHash, retryCount } }`

#### Scenario: JSON 解析失败后重试
- **WHEN** LLM 返回非 JSON 文本
- **THEN** 先尝试 `parseJsonFallback` 提取 `{...}`，失败后重试一次（缩短 prompt），仍失败则返回 `null`

#### Scenario: 口播稿基于文章内容生成
- **WHEN** GenerateScriptPhase 调用 `ctx.domain.generate.script(articleContent)`
- **THEN** 将 articleContent 注入 script prompt，返回 `{ content: { hook, overview, closing, ... }, meta: { ... } }`

### Requirement: render domain SHALL convert artifact content to markdown

合并 v3 的 `render-article.mjs` + `render-script.mjs`，提供 `article` 和 `script` 方法。

#### Scenario: 渲染文章
- **WHEN** RenderPhase 调用 `ctx.domain.render.article(articleContent, context)`
- **THEN** 返回 Markdown 字符串，包含 title/hook/summary_items/deep_items/important_items/brief_items/editorial/footer，格式与 v3 一致

#### Scenario: 渲染口播稿
- **WHEN** RenderPhase 调用 `ctx.domain.render.script(scriptContent)`
- **THEN** 返回带时间标注的 Markdown 字符串，总时长与 v3 一致

### Requirement: validate domain SHALL check schema and content quality

继承 v3 的 8 项内容质量检查 + article-script 一致性检查。

#### Scenario: Schema 校验
- **WHEN** ValidatePhase 调用 `ctx.domain.validate.run(articleArtifact, scriptArtifact, curatedEvents)`
- **THEN** 检查 ARTICLE_SCHEMA 和 SCRIPT_SCHEMA 的 required/fields/itemFields，返回 `{ articlePassed, scriptPassed, contentPassed, consistency, details }`

#### Scenario: 幻觉 URL 检测
- **WHEN** article 内容中出现 curated items 里不存在的 URL
- **THEN** `details.content.summary.hallucinated_url_count > 0`，`contentPassed` 可能为 false

#### Scenario: Article-Script 一致性
- **WHEN** article 和 script 的标题重叠率 < 50%
- **THEN** `consistency` 标记为不通过
