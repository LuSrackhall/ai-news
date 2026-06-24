## ADDED Requirements

### Requirement: Repository SHALL only modify state

Repository 负责写操作：`store(entity)` / `remove(id)`。不暴露 load / find / search（这些属于 ReadModel）。

#### Scenario: EventRepository.store
- **WHEN** ctx.scope.events.repository.store(events)
- **THEN** events 写入 JSON 文件（output/<date>/events.json）

#### Scenario: EventRepository.remove
- **WHEN** ctx.scope.events.repository.remove(eventIds)
- **THEN** 对应 events 从存储中移除

### Requirement: ReadModel SHALL only query state

ReadModel 负责读操作：`load()` / `history(days)` / `byEntity(entity)` / `search(query)`。

#### Scenario: EventReadModel.load
- **WHEN** ctx.scope.events.readModel.load()
- **THEN** 返回当前日期的 Event[]

#### Scenario: EventReadModel.history
- **WHEN** ctx.scope.events.readModel.history(14)
- **THEN** 返回最近 14 天的 Event[]（含当天）

### Requirement: UnitOfWork SHALL provide transaction semantics

UnitOfWork 提供 `begin()` / `commit()` / `rollback()`。JSON 文件实现下，commit() 是批量写。SQLite 下是 transaction。

#### Scenario: 批量写入
- **WHEN** uow.begin() → repoA.store(x) → repoB.store(y) → uow.commit()
- **THEN** x 和 y 同时写入（原子性）

#### Scenario: 回滚
- **WHEN** uow.begin() → repoA.store(x) → uow.rollback()
- **THEN** x 不写入

### Requirement: Storage SHALL use JSON files (v4.1)

v4.1 存储实现为 JSON 文件。输出到 `output/<date>/` 目录。未来可替换为 SQLite。

#### Scenario: 写入 events
- **WHEN** jsonFileStorage.write('events', data)
- **THEN** data 写入 output/<date>/events.json

#### Scenario: 读取 events
- **WHEN** jsonFileStorage.read('events')
- **THEN** 返回 output/<date>/events.json 的解析结果，不存在返回 null
