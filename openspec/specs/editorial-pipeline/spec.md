# Editorial Pipeline Spec

## Purpose

定义 Editorial Pipeline 的执行步骤和编排顺序。

## Requirements

### Requirement: Editorial Pipeline Steps

Editorial Pipeline SHALL 包含以下 steps，按顺序执行：
1. SelectEditorialWindow
2. DispatchLanes
3. ExecuteLanes
4. MergeCandidates
5. CurateEvents
6. GenerateArticle
7. GenerateScript
8. RenderArtifacts
9. ValidateOutput
10. ArchiveOutput

旧 step `BuildCandidates` SHALL 被移除，由 `DispatchLanes` + `ExecuteLanes` + `MergeCandidates` 三个 step 替代。

**Reason**: Lane 系统要求 Pipeline 将单一步骤拆分为三步：先分发 Events 到各 Lane，再独立构建，最后合并。这是为解决异构信息在同一排序空间竞争的问题。

**Migration**: 删除旧的 `{ taskId: 'BuildCandidates', name: '构建候选池' }` step，插入三个新 step。

#### Scenario: Pipeline steps updated
- **WHEN** Editorial Pipeline 执行
- **THEN** steps 顺序 MUST 为 SelectEditorialWindow → DispatchLanes → ExecuteLanes → MergeCandidates → CurateEvents → ...
- **AND** BuildCandidates step SHALL NOT 存在于 Pipeline 中
