## ADDED Requirements

### Requirement: AssetStore SHALL support save/load/append

AssetStore 提供 Repository 语义的接口，v4.0 实现为 JSON 文件（`output/<date>/assets.json`）。

#### Scenario: 保存 Asset 列表
- **WHEN** CollectPhase 调用 `ctx.stores.assets.save(items)`
- **THEN** Store 将 Asset[] 写入 `output/<date>/assets.json`，覆盖已有内容

#### Scenario: 读取 Asset 列表
- **WHEN** VerifyPhase 调用 `ctx.stores.assets.load()`
- **THEN** Store 返回当前日期的 Asset[]，如果文件不存在返回空数组

#### Scenario: 追加 Asset
- **WHEN** 调用 `ctx.stores.assets.append(newItems)`
- **THEN** Store 读取已有 items，合并 newItems 后写回

### Requirement: EventStore SHALL support save/load/history

EventStore 提供 `save`、`load`、`history(days)` 三个方法。`history` 读取最近 N 天的 Event 数据，内部处理 v3 格式兼容。

#### Scenario: 保存 Event 列表
- **WHEN** ScorePhase 调用 `ctx.stores.events.save(events)`
- **THEN** Store 将 Event[] 写入 `output/<date>/events.json`

#### Scenario: 读取当前日期 Event
- **WHEN** CuratePhase 调用 `ctx.stores.events.load()`
- **THEN** 返回当前日期的 Event[]

#### Scenario: 读取历史 Event（v3 兼容）
- **WHEN** DedupPhase 调用 `ctx.stores.events.history(14)`
- **THEN** Store 遍历最近 14 天的产物，对 v3 格式（`curated.json` 含 `selected_items`）调用 v3-compat adapter 转换为 Event[]，合并返回

#### Scenario: 历史产物不存在
- **WHEN** `history(14)` 遇到某天目录不存在
- **THEN** 跳过该天，不抛异常，继续读取其他天

### Requirement: ArtifactStore SHALL support save/load by type

ArtifactStore 按 type（article/script）存储和读取 Artifact。

#### Scenario: 保存 Article Artifact
- **WHEN** GenerateArticlePhase 调用 `ctx.stores.artifacts.save('article', articleArtifact)`
- **THEN** Store 将 article Artifact 写入 `output/<date>/artifacts.json` 的 `article` 字段

#### Scenario: 读取 Article Artifact
- **WHEN** RenderPhase 调用 `ctx.stores.artifacts.load('article')`
- **THEN** 返回 ArticleArtifact 对象（含 content/rendered/meta 三层）

#### Scenario: 读取渲染后的 Markdown
- **WHEN** ArchivePhase 调用 `ctx.stores.artifacts.loadMarkdown('article')`
- **THEN** 返回 `artifact.rendered.markdown` 字符串

### Requirement: ExecutionStore SHALL save PipelineRun with any status

ExecutionStore 保存 PipelineRun 对象，支持 success/fatal/partial 三种状态。

#### Scenario: 保存成功运行
- **WHEN** PipelineRunner 调用 `ctx.stores.execution.save(run)` 且 `run.status = 'success'`
- **THEN** Store 将 PipelineRun 写入 `output/<date>/execution.json`

#### Scenario: 保存中途失败的运行
- **WHEN** PipelineRunner 在 Phase 5 失败后调用 `ctx.stores.execution.save(run)` 且 `run.status = 'fatal'`
- **THEN** Store 写入包含前 4 个 Phase 结果的 PipelineRun，`run.status = 'fatal'`
