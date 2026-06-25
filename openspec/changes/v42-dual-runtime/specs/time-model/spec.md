## ADDED Requirements

### Requirement: Event SHALL have time semantic model

每个 Event 包含四个时间字段：published_at、collected_at、effective_at、time_precision。

#### Scenario: 有 published_at
- **WHEN** RSS 条目有 published_at = '2026-06-24T09:15:00Z'
- **THEN** effective_at = '2026-06-24T09:15:00Z'，time_precision = 'second'

#### Scenario: 只有日期
- **WHEN** RSS 条目 published_at = '2026-06-24'
- **THEN** effective_at = '2026-06-24'，time_precision = 'day'

#### Scenario: 无 published_at
- **WHEN** RSS 条目无 published_at
- **THEN** effective_at = collected_at，time_precision = 'unknown'
