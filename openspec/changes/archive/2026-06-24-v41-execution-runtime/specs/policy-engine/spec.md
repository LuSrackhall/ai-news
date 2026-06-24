## ADDED Requirements

### Requirement: PolicyEngine SHALL execute registered Policies

PolicyEngine 通过注册表管理 Policy。`policyEngine.execute('ranking', data)` 查找对应 Policy 并执行。新增 Policy 不需要改 Engine。

#### Scenario: 执行评分 Policy
- **WHEN** policyEngine.execute('ranking', assets)
- **THEN** 调用 RankingPolicy.execute(assets)，返回评分结果

#### Scenario: 执行去重 Policy
- **WHEN** policyEngine.execute('dedup', { today, history })
- **THEN** 调用 DedupPolicy.execute({ today, history })，返回 { kept, removed }

#### Scenario: 未知 Policy 名称
- **WHEN** policyEngine.execute('unknown', data)
- **THEN** 抛出 Error('Unknown policy: unknown')

### Requirement: Policy SHALL only do composition and decision

Policy 只做组合和决策（调用 Rule、组合结果），不碰 Repository / ReadModel / Service。数据由 Task 预先组装好传入。

#### Scenario: RankingPolicy 由多个 Rule 组成
- **WHEN** RankingPolicy.execute(assets)
- **THEN** 依次调用 AuthorityRule / TimelinessRule / EntityWeightRule 等，组合得分

#### Scenario: Policy 不访问 IO
- **WHEN** 审查 RankingPolicy 代码
- **THEN** 不出现 readFileSync / writeFileSync / fetch / ctx.scope 等 IO 操作

### Requirement: Rule SHALL be pure function

Rule 无状态、无 IO，只做纯计算。接收输入数据，返回 `{ type: 'base'|'bonus', score }`。

#### Scenario: AuthorityRule 评分
- **WHEN** authorityRule.evaluate({ source: { tier: 1 } })
- **THEN** 返回 { type: 'base', score: 20 }

#### Scenario: EntityWeightRule 评分
- **WHEN** entityWeightRule.evaluate({ title: 'OpenAI releases GPT-6' })
- **THEN** 返回 { type: 'bonus', score: 10 }（匹配 OpenAI 实体权重）
