# Lane Dispatcher Spec

## Purpose

定义 Event 到 Lane 的分配规则和 Dispatch 确定性约束。

## Requirements

### Requirement: Event Dispatch

Lane Dispatcher SHALL 按 `editorialDomain` 字段将每个 Event 分发到对应 Lane。一个 Event MUST 且只能进入一个主 Lane。不匹配任何 Lane 的 Event MUST 进入 fallback Lane。

#### Scenario: Known domain matches correct lane
- **WHEN** Event.editorialDomain 为 "research"
- **THEN** Dispatcher MUST 将该 Event 归入 research Lane

#### Scenario: Unknown domain falls back
- **WHEN** Event.editorialDomain 为 "unknown_category"
- **THEN** Dispatcher MUST 归入 fallback Lane

### Requirement: Deterministic Dispatch

Lane Dispatcher MUST 是纯确定性函数——相同输入 Event[] + 相同 LaneConfig 必定输出相同 LaneMap。

#### Scenario: Deterministic output
- **WHEN** 两次调用 dispatcher.dispatch(events, config)
- **THEN** 两次输出的 LaneMap MUST 完全相同

### Requirement: Lane Collection

Lane 集合 MUST 通过配置定义，不在 Runtime 中硬编码。Runtime SHALL NOT 假设任何具体 Lane ID 的存在。

#### Scenario: Config-driven lanes
- **WHEN** LaneConfig 定义 3 个 Lane（research, industry, policy）
- **THEN** Dispatcher 只向这 3 个 Lane + fallback 分发 Event
