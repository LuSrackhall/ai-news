## ADDED Requirements

### Requirement: 重要动态类别标签

重要动态章节的每条新闻必须附带一个类别标签，标签从枚举闭集中选取。

#### Scenario: Agent 选题时分配标签
- **WHEN** Agent 从候选事件中选出一条进入"重要动态"章节
- **THEN** Agent 必须从 `[模型发布] [AI政策] [产品应用] [开源项目] [融资收购] [研究论文] [开发者工具] [AI安全]` 中选择一个标签

#### Scenario: 渲染时显示标签
- **WHEN** 重要动态条目被渲染为 Markdown
- **THEN** 每条标题前显示 `**[标签名]**` 格式的粗体标签

#### Scenario: GitHub 通过过滤的项目归入开源项目
- **WHEN** 事件来源为 GitHub/Atom 源且通过噪音过滤
- **THEN** 该事件的类别标签为 `[开源项目]`，归入"重要动态"章节

### Requirement: 编辑观点精简为3段

编辑观点从4段（观察/证据/判断/预测）精简为3段（观察/证据/判断）。

#### Scenario: 编辑观点渲染
- **WHEN** article.json 中的 editorial 字段被渲染
- **THEN** 只渲染 observation、evidence、judgment 三个字段，prediction 字段被忽略

#### Scenario: 口播稿收尾段
- **WHEN** script.json 中的 closing 被渲染
- **THEN** closing 的 text 字段包含对未来的判断（原"预测"内容合并进"判断"）

### Requirement: curation prompt 更新

curation.md prompt 需要更新以适配新的类别标签和数量范围。

#### Scenario: Agent 选题输出
- **WHEN** Agent 执行 curation 任务
- **THEN** 输出的每个 selected_item 包含 `category` 字段，值为枚举闭集中的一个
- **AND** 重要动态数量范围为 5-8 条（原 3-5 条）
- **AND** 快讯数量范围为 5-8 条（原 3-5 条）
