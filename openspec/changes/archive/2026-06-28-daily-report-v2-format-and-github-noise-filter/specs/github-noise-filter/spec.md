## ADDED Requirements

### Requirement: GitHub 噪音过滤规则

对来源为 GitHub/Atom 的事件，在评分前执行正则过滤，拦截 commit/issue/PR 噪音。

#### Scenario: 丢弃 commit 类噪音
- **WHEN** 事件 URL 包含 `/issues/`、`/pull/`、`/commit/` 或 `/actions/`
- **THEN** 该事件被拦截，写入隔离池，不进入评分流程

#### Scenario: 丢弃低价值 commit 标题
- **WHEN** 事件标题匹配 `/^(fix|chore|ci|docs|build|test|refactor)(\(|:)/`
- **THEN** 该事件被拦截，写入隔离池

#### Scenario: 保留有价值的发布事件
- **WHEN** 事件标题匹配 `/^(feat|release|breaking)(\(|:)/` 或包含版本号 `/v\d+\.\d+/`
- **THEN** 该事件通过过滤，进入评分流程

#### Scenario: 保留新 repo 创建
- **WHEN** 事件标题为 `org/repo` 格式（新仓库创建）
- **THEN** 该事件通过过滤，进入评分流程

### Requirement: 隔离池存储

被噪音过滤器拦截的事件存入 SQLite quarantine 表，保留 3 天供调试。

#### Scenario: 拦截事件入库
- **WHEN** 一个事件被噪音过滤器拦截
- **THEN** 该事件写入 quarantine 表，expires_at 为当前时间 + 3 天

#### Scenario: 自动清理过期事件
- **WHEN** ingestion pipeline 启动时
- **THEN** 执行 `DELETE FROM quarantine WHERE expires_at < now`

#### Scenario: 可查询隔离池
- **WHEN** 运行查询 `SELECT * FROM quarantine WHERE source_id = 'deepseek-github'`
- **THEN** 返回该源被拦截的所有事件及拦截原因

### Requirement: 噪音过滤可配置

config.mjs 中的 GITHUB_NOISE_RULES 支持开关和自定义规则。

#### Scenario: 全局开关
- **WHEN** `GITHUB_NOISE_RULES.enabled` 设为 false
- **THEN** 跳过所有噪音过滤，所有 GitHub 事件正常进入评分

#### Scenario: 自定义保留天数
- **WHEN** `GITHUB_NOISE_RULES.quarantineDays` 设为 5
- **THEN** 隔离池事件保留 5 天后清理
