## ADDED Requirements

### Requirement: Cross-Day Dedup via Memory

Judgment Engine SHALL 在 Qualification 阶段查询 Memory，检测事件是否已在近期报道中覆盖。

#### Scenario: Same cluster qualified
- **WHEN** 事件的 cluster_id 与 Memory 中某 Story 的 event_ids 匹配
- **AND** 匹配记录在 3 天内
- **THEN** Judgment Engine MUST 产出 FOLLOW_UP signal（RANK phase，可配置权重，默认 -10）

#### Scenario: No cluster_id falls back to entity
- **WHEN** 事件没有 cluster_id
- **AND** 事件的 entity（首实体）在 Memory 中连续 3 天出现
- **THEN** Judgment Engine SHOULD 产出 FOLLOW_UP signal

#### Scenario: Stale story with no new content
- **WHEN** Memory 中某个 Story 标记为 stale
- **AND** 事件的 cluster_id 与该 Story 匹配
- **THEN** Judgment Engine MAY 产出 contextual rejection
- **AND** BREAKING 信号 MUST 覆盖 STALE 拒绝

### Requirement: Low-Density Day Backfill

Judgment Engine SHALL 在限定条件下从 events.db 自动补入高质量事件。

#### Scenario: Backfill triggered below threshold
- **WHEN** QualifiedEvents < 20
- **THEN** Judgment Engine MUST 从 events.db 查询 `source_name IN ('huggingface-blog', 'openai', 'anthropic', 'google-ai-blog', 'deepmind')`
- **AND** 补入的事件 MUST 有 rank_total >= 40
- **AND** 补入上限 10 条
- **AND** 补入事件 MUST 标记 `_backfill: true`

#### Scenario: Backfill not triggered above threshold
- **WHEN** QualifiedEvents >= 20
- **THEN** MUST NOT 触发补入
