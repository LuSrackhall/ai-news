## ADDED Requirements

### Requirement: Category Coverage Minimum

Candidate Pool SHALL 覆盖至少 5 个不同的 category。若 Filter Phase 后覆盖 < 5 类，DiversityRule MUST 从 review tier（score 55-69）中按缺失 category 最高分补入 Candidate，直到覆盖 ≥ 5 类或 review tier 无更多候选。

#### Scenario: Insufficient category coverage
- **WHEN** Filter Phase 后 Candidate Pool 仅覆盖 3 个 category
- **THEN** DiversityRule MUST 从 review tier 补入缺失 category 的最高分 Event
- **AND** 补入后 Candidate Pool SHALL 覆盖 ≥ 3 个 category（补到无更多候选为止）

#### Scenario: Sufficient category coverage
- **WHEN** Filter Phase 后 Candidate Pool 已覆盖 ≥ 5 个 category
- **THEN** DiversityRule SHALL NOT 补入任何 Event

### Requirement: Per-Category Cap

单 category 的 Candidate 数量上限为 8 条。超出上限的 Candidate SHALL 被标记为 `{ phase: "FILTER", subtype: "DIVERSITY_CAP" }`（HOLD）。

#### Scenario: Category exceeds cap
- **WHEN** 某 category 有 12 条 Candidate
- **THEN** 排序后第 9-12 条 Candidate SHALL 被产出 DIVERSITY_CAP Signal

### Requirement: BREAKING Exempt from Cap

BREAKING subtype Signal 已标记的 Candidate SHALL NOT 计入单 category 上限统计。

#### Scenario: BREAKING candidate in full category
- **WHEN** 某 category 有 8 条普通 Candidate + 2 条 BREAKING Candidate
- **THEN** 8 条普通 Candidate SHALL NOT 触发 DIVERSITY_CAP
- **AND** 2 条 BREAKING Candidate SHALL NOT 计入上限
