## ADDED Requirements

### Requirement: Asset SHALL represent raw traceable input

Asset 是 Pipeline 收集到的原始条目，只包含采集时可获得的字段。评分、选题结果不回流到 Asset。

#### Scenario: RSS 采集产生 Asset
- **WHEN** CollectPhase 从 RSS 源采集到一条新闻
- **THEN** 产出 Asset 包含 id、type、title、url、summary、source（name/tier/url）、publishedAt、fetchedAt、contentHash、category、language、metadata（impactScore/urlVerified/deadLink/dateFromHtml）

#### Scenario: Asset 不包含评分结果
- **WHEN** ScorePhase 完成评分
- **THEN** 评分结果写入 Event.rank，Asset 对象不被修改

### Requirement: Event SHALL represent understood knowledge with domain snapshots

Event 是 Pipeline 的核心数据模型。v4.0 中 `1 Asset = 1 Event`。Event 的 `rank` 字段是 Ranking Domain 的派生快照，`curation` 字段是 Curation Domain 的派生快照。`sources[]`、`assetIds[]`、`clusterId` 是稳定连接器。

#### Scenario: Asset 转换为 Event（v4.0 1:1）
- **WHEN** ScorePhase 处理一个 Asset
- **THEN** 产出的 Event 包含：id (= asset.id)、type、title、summary、url、sources[1]、assetIds[1]、clusterId(null)、contentHash、rank 快照、curation(null)、entities[]、topics[]、timeline

#### Scenario: Curation 后 Event 更新快照
- **WHEN** CuratePhase 完成 LLM 选题
- **THEN** 被选中的 Event 的 `curation` 字段更新为 `{ importance, note }`，未被选中的 Event 的 `curation` 保持 null

#### Scenario: v4.1 聚类只改连接器字段
- **WHEN** v4.1 引入 Event Cluster（N Asset = 1 Event）
- **THEN** 只有 `sources[]`（多个）、`assetIds[]`（多个）、`clusterId`（非 null）、`entities[]`、`topics[]` 发生变化，下游 Generate/Render/Validate 的消费接口不变

### Requirement: Artifact SHALL separate content/rendered/meta layers

Artifact 分为三层：`content`（LLM 生成的结构化内容）、`rendered`（Markdown/HTML 等投放形态）、`meta`（model/promptVersion/eventIds/generatedAt）。

#### Scenario: Article Artifact 结构
- **WHEN** GenerateArticlePhase 完成文章生成
- **THEN** 产出 ArticleArtifact 包含 `content`（hook/summaryItems/deepItems/importantItems/briefItems/editorial）、`rendered`（null，由 RenderPhase 填充）、`meta`（generatedAt/model/promptVersion/eventIds/inputHash/retryCount）

#### Scenario: RenderPhase 填充 rendered 层
- **WHEN** RenderPhase 渲染文章
- **THEN** `artifact.rendered.markdown` 被填充为 Markdown 字符串，`artifact.content` 不变

#### Scenario: 加新渠道只加 rendered projection
- **WHEN** v4.1 需要支持公众号 HTML
- **THEN** 只需在 `artifact.rendered` 中新增 `html` 字段，`content` 层不变

### Requirement: contentHash SHALL be a first-class field

Asset 和 Event 的 `contentHash` 是一等字段（不在 metadata 中），用于 dedup / cache / replay。

#### Scenario: Asset contentHash 在采集时计算
- **WHEN** CollectPhase 产出 Asset
- **THEN** `contentHash = sha256(title + url + summary + publishedAt)`，由采集/归一化阶段计算

#### Scenario: Event contentHash 继承自 Asset
- **WHEN** ScorePhase 将 Asset 转为 Event
- **THEN** Event 的 contentHash 直接继承 Asset 的 contentHash（v4.0 1:1 关系）

### Requirement: v3-compat adapter SHALL read v3 artifacts

v4 通过 `scripts/engine/adapters/v3-compat.mjs` 读取 v3 历史产物，只做读兼容，不做写兼容。

#### Scenario: 读取 v3 curated.json
- **WHEN** `EventStore.history(14)` 遇到 v3 格式的 curated.json
- **THEN** adapter 自动检测 items 数组 key（`selected_items` → `curated_items` → `valid_items`），将 v3 item 转换为 Event 格式返回，字段映射：`summary_zh→summary`、`source_name→source.name`、`source_tier→source.tier`、`total_score ?? scores?.total→rank.totalScore`、`tier_label→rank.tierLabel`、`importance→curation.importance`、`keywords→entities`

#### Scenario: v3 产物格式异常
- **WHEN** v3 curated.json 缺少所有 items key（selected_items / curated_items / valid_items）
- **THEN** adapter 返回空数组，不抛异常
