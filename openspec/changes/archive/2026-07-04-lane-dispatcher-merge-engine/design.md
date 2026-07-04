## Context

Candidate Builder v1.0 提供 Lane 内的排序和筛选能力。但所有 Event 仍在同一个排序空间中竞争，arXiv（66%）压倒行业新闻。brainstorm-spec.md 定义了 Lane Dispatcher + Merge Engine 作为解决方案——本文档聚焦实现层决策。

引用宪法约束：
- **Invariant 5**: Lane Dispatcher 和 Merge Engine 必须确定性执行
- **Invariant 7**: Runtime 只编排，业务规则在 Domain 层
- **Invariant 6**: Lane 集合通过配置定义，不硬编码

## Goals / Non-Goals

**Goals:**
- 定义 Lane Dispatcher 的数据结构与分发逻辑
- 定义 Lane Execution 如何复用 CandidateBuilder
- 定义 Merge Engine 的多阶段 Pipeline
- 定义 Pipeline 集成方式（3 个新 Task 替换 1 个 Task）

**Non-Goals:**
- 不改 CandidateBuilder v1.0 代码
- 不改 Signal / ResolutionPolicy
- 不改 Scoring
- 不引入新的 Signal type

## Decisions

### D1: 模块结构

```
scripts/domain/editorial/
  lane-dispatcher.mjs   # Lane Dispatcher — 将 Events 分发到 Lane
  merge-engine.mjs      # Merge Engine — 跨 Lane 合并候选池
  lane-types.mjs        # LaneId 类型定义 + 默认 Lane 集合

scripts/tasks-editorial/
  dispatch-lanes.mjs    # Pipeline Task：分发
  execute-lanes.mjs     # Pipeline Task：各 Lane 独立构建
  merge-candidates.mjs  # Pipeline Task：合并
  === REMOVED ===
  build-candidates.mjs  # 被以上三个 Task 拆分替代
```

### D2: Lane Dispatcher 数据结构

```javascript
// LaneId 是稳定字符串，由 Publication 配置声明，Runtime 不做内建假设
// Phase 2 的默认配置：
const DEFAULT_LANE_CONFIG = {
  research:   { domain: 'research',   maxSize: 15 },
  industry:   { domain: 'industry',   maxSize: 15 },
  policy:     { domain: 'policy',     maxSize: 10 },
  opensource: { domain: 'opensource', maxSize: 10 },
  fallback:   { domain: 'fallback',   maxSize: 5 },
}

// 分发结果
LaneMap = Map<LaneId, Event[]>
```

Lane Dispatcher 遍历 Events，按 `event.editorialDomain`（由 Ingestion 阶段填充）匹配 LaneId。不匹配时归入 `fallback`。不修改 Event。

### D3: Lane Execution 流程

```javascript
for (const [laneId, laneEvents] of laneMap) {
  // 每个 Lane 独立构建，使用统一的 CandidateBuilder
  const config = laneConfigs.get(laneId)
  const builder = new CandidateBuilder(rules, { maxSize: config.maxSize })
  const result = builder.build(laneEvents, context)
  laneResults.set(laneId, {
    candidates: result.finalCandidates,
    signalLog: result.signalLog,
    stats: { in: result.filteredIn, out: result.filteredOut },
  })
}
```

CandidateBuilder 的接口完全不改变。

### D4: Merge Engine 多阶段 Pipeline

```javascript
function merge(laneResults, globalConfig) {
  // Phase 1: Collect — 收集所有 Lane 的 candidates，标记 LaneId
  const allCandidates = collect(laneResults)

  // Phase 2: MergePolicy — 先应用最小保障
  allCandidates = applyMinRepresentation(allCandidates, laneResults, policyConfig)
  allCandidates = applyBreakingOverride(allCandidates, policyConfig)
  allCandidates = applyGlobalDiversity(allCandidates, events)

  // Phase 3: Rank
  allCandidates.sort((a, b) => b.finalRank - a.finalRank)

  // Phase 4: Truncate
  return allCandidates.slice(0, globalConfig.maxSize)
}
```

### D5: Pipeline 集成

```
旧 step:  { taskId: 'BuildCandidates', name: '构建候选池' }

新 steps:
  { taskId: 'DispatchLanes',      name: '分发至编辑轨道' },
  { taskId: 'ExecuteLanes',       name: '各轨道独立构建' },
  { taskId: 'MergeCandidates',    name: '合并候选池' },
```

ctx 数据流：
- `DispatchLanes` 写入 `ctx._laneMap` → `ctx._laneConfigs`
- `ExecuteLanes` 读取 `ctx._laneMap`，写入 `ctx._laneResults`
- `MergeCandidates` 读取 `ctx._laneResults`，写入 `ctx._candidates` + `ctx._buildResult`
- `CurateEvents` 继续消费 `ctx._candidates`（无需修改）

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| editorialDomain 判定不准导致 Event 分错 Lane | fallback Lane 兜底，分发日志可调试 |
| 各 Lane 顺序执行增加 Pipeline 延迟 | 现有 CandidateBuilder 在各 Lane 上都是纯计算 < 200ms，3-4 个 Lane 总 < 1s |
| Merge Policy 引入隐式配额感 | Policy 可配置，默认配置不设硬配额——仅保证非空 Lane 至少 1 条 |
| 与已有 BreakingRule 的交互复杂 | Merge.breaking_override 只影响跨 Lane 排序优先级，不影响 Lane 内部逻辑 |

## Open Questions

- Merge Policy 的 `minimum_representation` 是否应该在 Lane 为空时不产生任何效果？**已决定**：是的，空 Lane 不贡献。
- `ExecuteLanes` 是顺序执行还是并行？Phase 2 先顺序（保持简单），Phase 2.1 可并行。
