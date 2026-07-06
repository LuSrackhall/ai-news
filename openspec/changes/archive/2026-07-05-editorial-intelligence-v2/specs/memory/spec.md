## ADDED Requirements

### Requirement: Story Tracking

Memory SHALL 追踪每个事件的发展脉络，支持按时间线查询同一故事的不同阶段。

#### Scenario: Track event progression
- **WHEN** 同一实体/主题的事件在不同日期出现（如 OpenAI GPT-6 的发布、benchmark、API）
- **THEN** Memory MUST 识别它们属于同一 Story 的不同阶段
- **AND** 提供从最早到最新的完整时间线

#### Scenario: Query story timeline
- **WHEN** Judgment 查询一个事件的 story_timeline
- **THEN** Memory MUST 返回该 Story 的所有已知事件及其时间戳
- **AND** MUST 在没有历史时返回空数组

### Requirement: Editorial History

Memory SHALL 记录所有已报道事件的历史存档。

#### Scenario: Day snapshot saved
- **WHEN** 日报生成完成
- **THEN** Memory MUST 保存当日的 DaySnapshot（含 topEventIds、topEntities、topCategories）

#### Scenario: Historical query
- **WHEN** Judgment 查询一个事件的历史覆盖情况（coverage_count、last_reported_at）
- **THEN** Memory MUST 返回对应的聚合数据
- **AND** MUST 在没有历史时返回默认值（coverage_count=0）

### Requirement: Story Lifecycle State

Memory SHALL 为每个 Story 维护生命周期状态，驱动 Judgment 的编辑决策。

#### Scenario: Emerging story boosted
- **WHEN** 一个 Story 处于 Emerging 阶段（首次出现）
- **THEN** Memory MUST 将该状态提供给 Judgment
- **AND** Judgment SHOULD 优先考虑该事件

#### Scenario: Follow-up story detected
- **WHEN** 一个 Story 处于 Follow-up 阶段（已有持续报道）
- **THEN** Memory MUST 提供 last_reported_at 和 coverage_count
- **AND** Judgment SHOULD 对此事件的 Qualification 门槛适当降低

#### Scenario: Stale story suppressed
- **WHEN** 一个 Story 处于 Stale 阶段（无实质更新）
- **THEN** Memory MUST 标记该状态
- **AND** Judgment SHOULD 对该事件的 Prioritization 予以降权

### Requirement: Rejected Events Log

Memory SHALL 记录被 Judgment 拒绝的事件及原因，提供可追溯性。

#### Scenario: Rejection reason stored
- **WHEN** Judgment 拒绝了一个事件并调用 Memory.log(rejectedEvent)
- **THEN** Memory MUST 记录：事件 ID、拒绝原因、拒绝类型（Hard/Contextual）、拒绝时间

#### Scenario: Rejection query
- **WHEN** Judgment 查询一个事件的 rejection_history
- **THEN** Memory MUST 返回该事件之前被拒绝的记录（含原因和类型）
- **AND** MUST 在没有拒绝记录时返回空数组

### Requirement: Advisory Only

Memory MUST NOT 阻止 Qualification 的执行。Judgment MUST 能在 Memory 无响应时正常工作。

#### Scenario: Memory failure during qualification
- **WHEN** Memory 在 Qualification 阶段不可用
- **THEN** Qualification MUST 继续执行
- **AND** 基于事件本身内容独立判断
- **AND** MUST 不抛出 Memory 相关异常

#### Scenario: Memory latency
- **WHEN** Memory 查询延迟超过超时阈值
- **THEN** Judgment MUST 降级处理（跳过 Memory 查询）
- **AND** MUST 不阻塞 Pipeline

### Requirement: Durability

Memory SHALL 使用持久化存储，支持进程重启后数据恢复。

#### Scenario: Data survives restart
- **WHEN** 进程重启后 Memory 初始化
- **THEN** 所有已保存的 Story Tracking 数据、Editorial History、Rejection Log MUST 可恢复

#### Scenario: Concurrent write safety
- **WHEN** 多个进程/事件同时写入 Memory
- **THEN** MUST 不出现数据损坏或丢失
