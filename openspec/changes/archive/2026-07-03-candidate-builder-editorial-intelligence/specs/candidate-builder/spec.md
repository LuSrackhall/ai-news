## ADDED Requirements

### Requirement: Three-Phase Signal Lifecycle

系统 SHALL 按 FILTER → RANK → ANNOTATION 三阶段顺序消费 EditorialSignal。

FILTER 阶段：BREAKING subtype 的 Signal MUST override 所有同 event 的 FILTER 约束。DIVERSITY_CAP subtype 的 Signal MUST 将对应 event 标记为 HOLD（不可入选，不降低 score）。

RANK 阶段：所有 RANK-phase Signal 的 weight SHALL 累加到 event 的原始 score，总 boost 上限为 +30。

ANNOTATION 阶段：所有 ANNOTATION-phase Signal SHALL 被转换为 Candidate.contextHints 文本提示，不影响排序。

#### Scenario: BREAKING overrides DIVERSITY_CAP
- **WHEN** 同一 event 同时有 BREAKING Signal 和 DIVERSITY_CAP Signal
- **THEN** 该 event SHALL NOT 被 HOLD
- **AND** MUST 出现在 Filter View 中

#### Scenario: RANK boost capped
- **WHEN** 某 event 的 RANK-phase Signal weight 总和超过 30
- **THEN** 实际 boost SHALL 被截断为 +30

#### Scenario: ANNOTATION has zero ranking effect
- **WHEN** 某 event 有 MEMORY subtype 的 ANNOTATION Signal
- **THEN** 该 Signal SHALL NOT 影响 finalRank 的计算
- **AND** MUST 出现在 Candidate.contextHints 中
