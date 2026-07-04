# Merge Engine Spec

## Purpose

定义跨 Lane 候选池合并、排序和策略执行规则。

## Requirements

### Requirement: Cross-Lane Merge

Merge Engine SHALL 收集所有 Lane 的候选池，经过可配置的 Merge Policy 处理，最终排序并截断为全局 Candidate[]（maxSize 默认 40）。

#### Scenario: Basic merge
- **WHEN** 3 个 Lane 分别产出 5、8、3 条 candidates
- **THEN** Merge Engine MUST 合并为 16 条并排序

### Requirement: Minimum Representation

当 Merge Policy 启用 `minimum_representation` 时，每个非空 Lane 至少贡献 1 条 Candidate 到全局池（除非全局 maxSize 超限）。

#### Scenario: Minimum representation
- **WHEN** 某 Lane 有 candidates，但所有 candidates 的 finalRank 都低于其他 Lane
- **THEN** 该 Lane 的 top candidate MUST 仍然出现在全局池中

### Requirement: Breaking Override

当 Merge Policy 启用 `breaking_override` 时，携带 BREAKING Signal 的 Candidate 在跨 Lane 排序中获得优先级（除非全局 maxSize 超限）。

#### Scenario: Breaking override
- **WHEN** 某 industry Lane 的 Candidate 携带 BREAKING Signal 但 finalRank 低于 research Lane 的 Candidate
- **THEN** 该 BREAKING Candidate MUST 出现在全局池中（除非超限）

### Requirement: Configurable Policy

Merge Policy SHALL 通过配置启用/禁用各项策略，不在 Merge Engine 中硬编码。

#### Scenario: Policy disabled
- **WHEN** MergePolicy 的 minimum_representation 设为 false
- **THEN** 所有 Candidate 完全按 finalRank 合并，无 Lane 保底
