## ADDED Requirements

### Requirement: InferenceProfile SHALL be a configuration object

Profile 包含 model / prompt / schema / examples / temperature / retry / validator / postProcessor。不执行任何逻辑。

#### Scenario: 创建 ArticleProfile
- **WHEN** new InferenceProfile({ model: 'sonnet', prompt: '...', schema: {...}, retry: 1 })
- **THEN** Profile 对象持有配置，不发起任何 LLM 调用

### Requirement: InferenceService SHALL execute profiles via host

Service 调用 host.invoke()，处理 JSON 解析兜底、重试、校验、后处理。Task 中通过 `ctx.scope.inference.run('article', variables)` 调用。

#### Scenario: 正常执行
- **WHEN** inferenceService.run('article', { input_data: '...' })
- **THEN** 渲染 Profile prompt → host.invoke() → JSON 解析 → 校验 → 返回结构化结果

#### Scenario: JSON 解析失败后重试
- **WHEN** host.invoke 返回非 JSON 文本
- **THEN** 先 parseJsonFallback 提取 {...}，失败后重试一次（缩短 prompt）

#### Scenario: Profile 不存在
- **WHEN** inferenceService.run('unknown', {})
- **THEN** 抛出 Error('Unknown profile: unknown')
