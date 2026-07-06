## ADDED Requirements

### Requirement: Qualification Pipeline

Judgment Engine SHALL 按 Qualification → Prioritization 两阶段处理事件。Qualification 不排序，Prioritization 不淘汰。

#### Scenario: Events pass through qualification then prioritization
- **WHEN** 一组 Events 进入 Judgment Engine
- **THEN** 先经过 Qualification 阶段
- **AND** 输出的 QualifiedEvents 再进入 Prioritization 阶段
- **AND** 最终输出 PrioritizedCandidates（数量 ≤ Budget）

#### Scenario: Empty event list
- **WHEN** Qualification 收到空事件列表
- **THEN** MUST 返回空的 QualifiedEvents 和 RejectedEvents
- **AND** MUST 不抛出异常

### Requirement: Explicit Rejection Path

Qualification 阶段 MUST 显式输出 RejectedEvents，不能仅靠排序截断隐式排除。

#### Scenario: Non-AI content is rejected
- **WHEN** 事件内容与 AI / 科技领域无关（如纯商业纠纷、娱乐榜单）
- **THEN** Qualification MUST 将该事件标记为 Hard Rejection
- **AND** 该事件 MUST NOT 出现在 QualifiedEvents 中

#### Scenario: Low-competition rejection
- **WHEN** 事件内容合格但当天竞争激烈
- **THEN** Qualification MAY 标记为 Contextual Rejection
- **AND** 该事件 MAY 在后续日期重新进入候选

#### Scenario: Rejection reason is recorded
- **WHEN** Qualification 拒绝了一个事件
- **THEN** RejectedEvent MUST 包含拒绝原因
- **AND** 拒绝原因 MUST 被记录到 Memory

### Requirement: Budget-Aware Prioritization

Prioritization 阶段 MUST 接收显式 Budget 参数，输出 <= Budget 条 PrioritizedCandidates。

#### Scenario: Budget constraint enforced
- **WHEN** QualifiedEvents 有 100 条，Budget = 40
- **THEN** PrioritizedCandidates MUST 不超过 40 条

#### Scenario: Budget overflow prevention
- **WHEN** Prioritization 内部发生 protected 项溢出
- **THEN** protected 项总数 MUST NOT 超过 Budget
- **AND** Budget 在 Prioritization 入口 MUST 强制校验

#### Scenario: Group-aware budget allocation
- **WHEN** Prioritization 接口收到分组提示（如"OpenAI 专题"）
- **THEN** 同一分组的多条事件 MAY 同时入选
- **AND** Budget 在该分组内按比例分配

### Requirement: Signal-Based Decision

Judgment Engine 的所有决策 MUST 基于 Signal，而非单一评分公式。

#### Scenario: Qualification uses BreakingSignal
- **WHEN** 事件触发了 BreakingRule 的 BreakingSignal
- **THEN** 该事件 MUST 在 Qualification 中通过
- **AND** 不受 Hard Rejection 规则影响

#### Scenario: Prioritization uses multiple signals
- **WHEN** Prioritization 对 QualifiedEvents 排序
- **THEN** MUST 同时考虑 EntityHeatSignal、FreshnessSignal、TopicSaturationSignal、SourceDiversitySignal
- **AND** 不依赖单一 finalRank 值

#### Scenario: Evaluation mode enabled
- **WHEN** Judgment Engine 以 Evaluation Mode 运行
- **THEN** MUST 收集指标数据（来源分布、拒绝原因分布、入选率等）
- **AND** MUST NOT 强制执行 Production Mode 的约束

### Requirement: Cold Start

Judgment Engine MUST 能在 Memory 不可用时正常工作。

#### Scenario: Memory unavailable at startup
- **WHEN** Memory 服务不可用或返回空
- **THEN** Judgment Engine MUST 以降级模式运行
- **AND** 所有事件按 Qualification 独立判断（不查询历史）
- **AND** MUST 不抛出异常

### Requirement: Source Whitelist

官方技术来源（HuggingFace Blog、OpenAI Blog、Anthropic 等）MUST 自动通过 ContentRelevanceRule 的 Qualification，不受标题关键词匹配结果影响。

#### Scenario: Official source bypasses keyword check
- **WHEN** 事件来自 HuggingFace Blog，标题过短或含 emoji 导致未命中 AI_TECH_KEYWORDS
- **THEN** ContentRelevanceRule MUST 仍将该事件标记为通过（因来源白名单）
- **AND** 白名单外的来源继续按关键词匹配判断
