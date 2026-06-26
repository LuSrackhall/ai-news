## ADDED Requirements

### Requirement: RsshubPool SHALL provide available instance URLs

连接池从实例列表中返回一个可用的实例 URL。全部熔断时返回 null。

#### Scenario: 正常获取实例
- **WHEN** 池中有 5 个实例，3 个 CLOSED 状态
- **THEN** 返回第一个 CLOSED 状态实例的 URL

#### Scenario: 全部熔断
- **WHEN** 所有实例都处于 OPEN 或 HALF-OPEN 状态且冷却未过期
- **THEN** 返回 null

#### Scenario: 冷却过期自动恢复
- **WHEN** 实例 A 的 cooldownUntil 已过期
- **THEN** 该实例进入 HALF-OPEN 状态，getInstance() 可返回该实例做试探

### Requirement: RsshubPool SHALL circuit-break on network failures

网络失败（超时、HTTP 5xx）触发熔断，冷却时间指数退避。

#### Scenario: 连续失败触发熔断
- **WHEN** 实例连续 reportFailure 3 次
- **THEN** 该实例状态变为 OPEN，cooldownUntil = now + 10min

#### Scenario: 冷却时间指数退避
- **WHEN** 实例第二次进入 OPEN 状态
- **THEN** cooldownUntil = now + 20min（10min × 2^1）

#### Scenario: 冷却时间上限
- **WHEN** 实例连续多次熔断
- **THEN** cooldownUntil 不超过 now + 2h

#### Scenario: 成功重置失败计数
- **WHEN** 实例 reportSuccess
- **THEN** consecutiveFailures 归零，状态变为 CLOSED

### Requirement: RsshubPool SHALL persist health to data/rsshub-health.json

健康状态持久化到文件，跨进程保持。

#### Scenario: 启动时加载历史状态
- **WHEN** collect-rss.mjs 启动，data/rsshub-health.json 存在
- **THEN** 读取文件恢复各实例的状态（包括 cooldownUntil）

#### Scenario: 请求结束后保存状态
- **WHEN** 采集完成
- **THEN** 将当前所有实例状态写入 data/rsshub-health.json

#### Scenario: 文件损坏时降级
- **WHEN** data/rsshub-health.json 内容非法
- **THEN** 重置为空对象，所有实例从 CLOSED 开始

### Requirement: fetchFeed SHALL route rsshub sources through pool

fetchFeed 对 rsshub 源通过连接池获取实例 URL 并拼接。

#### Scenario: rsshub 源正常采集
- **WHEN** source.rsshub = '/anthropic/news'，池中有可用实例
- **THEN** fetch URL 拼接为 instance + '/anthropic/news'，正常采集

#### Scenario: 全部实例不可用
- **WHEN** source.rsshub = '/anthropic/news'，池中无可用实例
- **THEN** 返回 status: 'error', error: 'All RSSHub instances down'

#### Scenario: 直接 RSS 源不受影响
- **WHEN** source.url = 'https://openai.com/news/rss.xml'，无 rsshub 字段
- **THEN** 行为与改造前完全一致

### Requirement: RSSHub sources SHALL use slower interval

RSSHub 源采集间隔 1-2 秒，避免对同一实例突发流量。

#### Scenario: RSSHub 源间隔
- **WHEN** 有 5 个 RSSHub 源和 20 个直接 RSS 源
- **THEN** 直接 RSS 源间隔 200ms，RSSHub 源间隔 1500ms
