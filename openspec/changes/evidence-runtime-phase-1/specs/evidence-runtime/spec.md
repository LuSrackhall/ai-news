## ADDED Requirements

### Requirement: EvidenceCollector 加载页面并截图
系统 SHALL 使用 Playwright 加载事件源 URL，执行 DOM 清理后定位内容区并截图。

#### Scenario: 正常加载新闻页面
- **WHEN** 事件 URL 指向一篇可公开访问的新闻文章
- **THEN** 系统 SHALL 加载页面完成、等待 networkidle、定位 `<article>` 或 `[role="main"]` 内容区，并截图

#### Scenario: 页面需要登录或付费墙
- **WHEN** 页面检测到 paywall/登录弹窗
- **THEN** 系统 SHALL 跳过截图并在 evidence.json 中标注 `confidence: 0`

#### Scenario: 页面加载超时
- **WHEN** 页面加载超过 30 秒
- **THEN** 系统 SHALL 超时中断，降级到首屏截图并标记 `fallback: timeout`

### Requirement: DOM 清理
系统 SHALL 在截图前注入 JS 清理广告、导航、弹窗等干扰元素。

#### Scenario: 广告清理
- **WHEN** 页面包含 `.ad`、`.advertisement`、`ins.adsbygoogle` 等广告元素
- **THEN** 系统 SHALL 通过 `element.remove()` 移除这些元素后再截图

#### Scenario: 弹窗清理
- **WHEN** 页面包含 cookie consent banner、newsletter popup、登录弹窗
- **THEN** 系统 SHALL 移除弹窗后再截图

### Requirement: 关键词评分段落定位
系统 SHALL 对内容区段落进行关键词评分，选取与事件最相关的段落截图。

#### Scenario: 关键词匹配评分
- **WHEN** 内容区有多个 `<p>` 段落
- **THEN** 系统 SHALL 对每个段落按事件 title + entities 生成的关键词评分，选取最高分段

#### Scenario: 无匹配段落
- **WHEN** 没有任何段落匹配关键词
- **THEN** 系统 SHALL 降级到内容区首屏截图

### Requirement: Evidence Scorer 三因子评分
系统 SHALL 对采集到的证据进行多因子评分。

#### Scenario: 关键词匹配评分
- **WHEN** 段落命中关键词数量为 N
- **THEN** 系统 SHALL 计算 `keyword_match = min(N / total_keywords, 1.0)`

#### Scenario: 信源权威评分
- **WHEN** 事件来源的 publisher 在 provenance_aliases 中有 trust_score
- **THEN** 系统 SHALL 计算 `source_authority = trust_score / 5`

#### Scenario: 多源交叉验证
- **WHEN** 同一事件有多个 ProvenanceEdge duplicate_of 关联
- **THEN** 系统 SHALL 计算 `provenance_crosscheck = min(duplicate_count / 3, 1.0)`

### Requirement: BuildEvidenceAssets Task
系统 SHALL 提供 BuildEvidenceAssets Task 集成到 editorial pipeline。

#### Scenario: Pipeline 集成
- **WHEN** editorial pipeline 运行到 BuildEvidenceAssets
- **THEN** 系统 SHALL 对 `ctx._curatedEvents` 中所有有 url 的事件执行 EvidenceCollector

#### Scenario: 失败容错
- **WHEN** 单个事件的证据采集失败
- **THEN** 系统 SHALL 跳过该事件继续处理下一个，不中断整个 pipeline

### Requirement: Renderer 消费 evidence[]
系统 SHALL 在 article.md 渲染时嵌入 evidence 图片。

#### Scenario: deep_item 有 evidence
- **WHEN** deep_item 的 evidence[] 不为空
- **THEN** renderer SHALL 输出 `![caption](path)` 在标题后、内容前

#### Scenario: important_item 有 evidence
- **WHEN** important_item 的 evidence[] 不为空
- **THEN** renderer SHALL 输出 `![title](path)` 在标题后、摘要前
