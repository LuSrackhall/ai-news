# Lane Execution Spec

## Purpose

定义 Lane 执行阶段的行为，包括独立构建和 CandidateBuilder 复用。

## Requirements

### Requirement: Independent Lane Execution

每个 Lane SHALL 使用独立的 CandidateBuilder 实例构建候选池。Lane 之间 SHALL NOT 共享状态或互相调用。

#### Scenario: Per-lane CandidateBuilder
- **WHEN** 对 research Lane 和 industry Lane 分别执行
- **THEN** 各自的 CandidateBuilder SHALL 独立运行
- **AND** research Lane 的 candidate 列表 SHALL NOT 受 industry Lane 事件影响

### Requirement: CandidateBuilder Unchanged

Lane Execution SHALL 直接复用现有的 CandidateBuilder 类，不修改其代码。LaneContext（maxSize 等）通过构造参数传入。

#### Scenario: Using existing CB
- **WHEN** Lane Execution 调用 CandidateBuilder
- **THEN** 使用的 MUST 是 `scripts/domain/editorial/candidate-builder.mjs` 中已存在的 CandidateBuilder 类
