# ADR-004: Candidate Builder

**Status:** `ACCEPTED` · **Date:** 2026-07-04

## Context

Candidate Builder 最初被设计为接收全部 Event 并产出一个候选池。553 Event 的实际数据揭示：在一个 Lane 内它执行正确，但不应该直接面对全部 Event。

## Decision

Candidate Builder 是 Editorial Runtime 内的一个 Service，负责在给定的 Event 子集（单 Lane）内构建候选池。它被 Lane 调用，而不是被 Pipeline 直接调用。

### 职责不变

- Signal 模型和 Resolution Policy
- Rule Pipeline（Breaking / Diversity / Memory / 未来新增）
- 确定性排序和截断

### 调用方式不变

```javascript
new CandidateBuilder(rules).build(events, context) → BuildResult
```

### 输入范围变化

```
旧：553 Events → Candidate Builder → 40 Candidates
新：Research 365 → Candidate Builder → ResearchPool
    Industry 132 → Candidate Builder → IndustryPool
    Merge → 40 Candidates
```

## Consequences

- Candidate Builder 本身不需要重构——它的接口、Rule Pipeline、Signal 模型全部保持
- 调用者的责任从"sortedByScore"变为"distributeToLanes + merge"
- 新的调用者（Lane Dispatcher + Editorial Merge）需要实现，但不影响已有逻辑
- 已有测试可继续使用，只需补充 Lane 分发和 Merge 的测试

## Alternatives Considered

- 重构 Candidate Builder 为 Lane-aware：不必要的侵入改造，调用层变化不应影响 Service 层
- 新建一个更大的编排器包含 Candidate Builder：名称混乱，不如保持单一职责
