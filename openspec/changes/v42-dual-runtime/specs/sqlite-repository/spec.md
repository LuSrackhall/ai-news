## ADDED Requirements

### Requirement: SQLite Event Repository SHALL store events with content_hash uniqueness

Events 表使用 `content_hash TEXT NOT NULL UNIQUE`，Ingestion 写入时使用 `INSERT OR IGNORE` 实现原子去重。

#### Scenario: 写入新事件
- **WHEN** StoreEvents Task 写入一个 content_hash 不存在的 Event
- **THEN** Event 成功插入 SQLite，返回 changes=1

#### Scenario: 重复事件被忽略
- **WHEN** StoreEvents Task 写入一个 content_hash 已存在的 Event
- **THEN** INSERT OR IGNORE 跳过，返回 changes=0，不报错

#### Scenario: 批量写入
- **WHEN** StoreEvents Task 调用 storeBatch(events)
- **THEN** 在一个事务内批量 INSERT OR IGNORE，新事件插入，重复事件跳过

### Requirement: Event Entity/Topic 关系表 SHALL support entity-based queries

event_entities 和 event_topics 关系表支持按实体/主题查询事件。

#### Scenario: 按实体查询
- **WHEN** readModel.findByEntity('OpenAI')
- **THEN** 返回所有 entities 包含 'OpenAI' 的 Event[]

#### Scenario: 按主题查询
- **WHEN** readModel.findByTopic('LLM')
- **THEN** 返回所有 topics 包含 'LLM' 的 Event[]

### Requirement: ReadModel SHALL query by effective_at window

Editorial 查询默认基于 effective_at，不是 collected_at。

#### Scenario: 按时间窗口查询
- **WHEN** readModel.findByWindow('2026-06-24T08:00:00', '2026-06-25T08:00:00')
- **THEN** 返回 effective_at 在该窗口内的 Event[]，按 rank_total DESC 排序
