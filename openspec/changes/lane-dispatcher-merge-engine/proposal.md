## Why

553 条 Event 在同一个排序空间中竞争时，arXiv 论文（66%）的评分优势压倒所有行业新闻，导致 Candidate Pool 中 90% 为论文。这不是评分错误——异构信息（论文、行业新闻、政策公告）的价值不应在同一个排序空间中比较。Constitution v4.0 已冻结（Runtime 只编排 / Domain 承载规则 / 确定性执行），Candidate Builder v1.0 已实现 Lane 内排序能力。现在需要将 Lane 从概念落地为运行时——实现 Event 分发、Lane 内独立构建、跨 Lane 合并。

## What Changes

- 新增 **Lane Dispatcher**：按 `editorialDomain` 将 Event 分发到对应 Lane，单 Event 归属单 Lane，确定性分发
- 新增 **Lane Execution**：每个 Lane 复用现有 CandidateBuilder v1.0 独立构建候选池
- 新增 **Merge Engine**：跨 Lane 合并候选池、全局排序、maxSize 截断；支持三种 Merge Policy（minimum_representation / breaking_override / global_diversity）
- 修改 Editorial Pipeline 步骤：`BuildCandidates` 拆分为 `DispatchLanes` → `ExecuteLanes` → `MergeCandidates`（**BREAKING**：Pipeline step 变化）
- 修改 `build-candidates.mjs` Task：拆分为三个独立 Task（**BREAKING**：Task 文件结构变化）

## Capabilities

### New Capabilities
- `lane-dispatcher`: Lane Dispatcher —— 按 editorialDomain 将 Events 分发到对应 Lane，确定性映射
- `lane-execution`: Lane Execution —— 每个 Lane 复用 CandidateBuilder 独立构建候选池
- `merge-engine`: Merge Engine —— 跨 Lane 合并、可配置 Merge Policy、全局排序与截断

### Modified Capabilities
- `editorial-pipeline`: Editorial Pipeline 步骤从 `BuildCandidates` 变更为 `DispatchLanes → ExecuteLanes → MergeCandidates`，需要同步更新 Pipeline 声明

## Impact

- 新增 `scripts/domain/editorial/lane-dispatcher.mjs`（分发逻辑）
- 新增 `scripts/domain/editorial/merge-engine.mjs`（合并引擎）
- 新增 `scripts/domain/editorial/lane-types.mjs`（LaneId 类型定义）
- 新增 `scripts/tasks-editorial/dispatch-lanes.mjs`（Pipeline Task）
- 新增 `scripts/tasks-editorial/execute-lanes.mjs`（Pipeline Task）
- 新增 `scripts/tasks-editorial/merge-candidates.mjs`（Pipeline Task）
- 删除 `scripts/tasks-editorial/build-candidates.mjs`（被拆分代替）
- 修改 `scripts/pipelines/editorial.mjs`（Pipeline steps 变更）
- 修改 `scripts/run-editorial.mjs`（Task 注册变更）
- 不修改 CandidateBuilder / Signal / ResolutionPolicy（v1.0 冻结）
