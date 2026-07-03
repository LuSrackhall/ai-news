## ADDED Requirements

### Requirement: Breaking Detection by Entity Priority

当 Event 包含 top_tier 实体（ENTITY_WEIGHTS.top_tier.entities 中定义）且该实体在当天所有 Event 中出现次数 ≤ 2 时，BreakingRule SHALL 产出 `{ phase: "FILTER", subtype: "BREAKING" }` Signal。

#### Scenario: High-entity singleton detected
- **WHEN** Event 包含实体 "OpenAI" 且当天仅 1 条 Event 包含 "OpenAI"
- **THEN** BreakingRule MUST 产出 BREAKING Signal

#### Scenario: High-entity common
- **WHEN** Event 包含实体 "OpenAI" 且当天有 10 条 Event 包含 "OpenAI"
- **THEN** BreakingRule SHALL NOT 产出 BREAKING Signal（不是独家）

### Requirement: Breaking Detection by Official Source

当 Event 来源为官方 Blog 域名（anthropic.com、openai.com、ai.meta.com、blogs.nvidia.com 等）且 cluster_size = 1 时，BreakingRule SHALL 产出 BREAKING Signal。

#### Scenario: Official blog singleton
- **WHEN** Event 来源为 "blogs.nvidia.com" 且 cluster size 为 1
- **THEN** BreakingRule MUST 产出 BREAKING Signal

### Requirement: Breaking Detection by Event Type

当 Event 的 event_type 为 "model_release" 或 "acquisition" 且原始 score ≥ review 阈值（55）时，BreakingRule SHALL 产出 BREAKING Signal。

#### Scenario: Model release with sufficient score
- **WHEN** Event 类型为 "model_release" 且 score ≥ 55
- **THEN** BreakingRule MUST 产出 BREAKING Signal

#### Scenario: Acquisition below threshold
- **WHEN** Event 类型为 "acquisition" 且 score < 55
- **THEN** BreakingRule SHALL NOT 产出 BREAKING Signal
