## MODIFIED Requirements

### Requirement: Editorial Memory History

Memory SHALL 支持通过 `load(date)` 方法查询历史报道快照。

#### Scenario: Load day snapshots
- **WHEN** 调用 `memoryStore.load(sinceDate)`
- **THEN** Memory MUST 返回指定日期之后的 DaySnapshot 数组
- **AND** MUST 在接口不可用（非 SqliteMemoryStore 实现）时按原行为降级
