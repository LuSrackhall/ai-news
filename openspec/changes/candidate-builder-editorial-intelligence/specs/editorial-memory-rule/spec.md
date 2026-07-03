## ADDED Requirements

### Requirement: Cross-Day Entity Memory

EditorialMemoryRule SHALL 查询最近 7 天的 Editorial Memory，若 Event 的主要 entity 或 cluster_id 命中历史 topEntities 或 topEventIds，则产出 `{ phase: "ANNOTATION", subtype: "MEMORY" }` Signal，metadata 中记录连续出现天数。

#### Scenario: Entity hit in recent history
- **WHEN** Event 包含 entity "OpenAI" 且 "OpenAI" 出现在最近 3 天的 topEntities 中
- **THEN** EditorialMemoryRule MUST 产出 MEMORY Signal 且 metadata.recentDays = 3

#### Scenario: No memory hit
- **WHEN** Event 的所有 entity 和 cluster_id 均不在最近 7 天的 Memory 中
- **THEN** EditorialMemoryRule SHALL NOT 产出任何 Signal

### Requirement: Consecutive-Day Context Hint

当同一 entity 连续 ≥ 2 天出现在 topEntities 时，MEMORY Signal 的 contextHint MUST 包含提示文本："此事件（entity: <entity>）已在最近 <N> 天持续报道，可考虑作为一句话更新而非重复深度分析"。

#### Scenario: Consecutive day annotation
- **WHEN** entity "Meta" 连续 3 天出现在 topEntities
- **THEN** MEMORY Signal 的 metadata.recentDays MUST = 3
- **AND** contextHint MUST 包含连续报道提示

### Requirement: Memory Store Interface

EditorialMemoryStore SHALL 提供 load(since)、save(date, snapshot)、prune(before) 三个方法。Phase 1 实现（JsonEditorialMemoryStore）SHALL 使用 `data/editorial-memory.json` 文件，包含最近 7 天的 DaySnapshot 数组。load() 失败时 SHALL 降级返回空 MemorySnapshot，不中断 Pipeline。

#### Scenario: Load failure degrades gracefully
- **WHEN** editorial-memory.json 文件损坏或不存在
- **THEN** memoryStore.load() SHALL 返回空的 MemorySnapshot（{ days: {} }）
- **AND** EditorialMemoryRule SHALL 正常完成（不产出任何 Signal）

#### Scenario: Prune old data
- **WHEN** 调用 prune("2026-06-25") 且 memory 中包含 2026-06-24 的数据
- **THEN** 2026-06-24 及之前的 DaySnapshot SHALL 被移除
- **AND** 2026-06-25 及之后的 DaySnapshot SHALL 保留
