## 1. Lane 类型定义与默认配置

- [x] 1.1 创建 `scripts/domain/editorial/lane-types.mjs`：定义 LaneId 类型、LaneConfig 结构、DEFAULT_LANE_CONFIG（research/industry/policy/opensource/fallback 共 5 个 Lane）

## 2. Lane Dispatcher

- [x] 2.1 创建 `scripts/domain/editorial/lane-dispatcher.mjs`：LaneDispatcher 类，`dispatch(events, laneConfigs)` 方法，按 `event.editorialDomain` 分发
- [x] 2.2 实现 fallback Lane：不匹配任何已注册 Lane 的 Event 进入 fallback
- [x] 2.3 验证确定性：相同输入必定输出相同 Lanemap

## 3. Lane Execution

- [x] 3.1 实现 Lane Execution 逻辑（在 `merge-engine.mjs` 中或独立模块）：遍历 LaneMap，对每个 Lane 创建独立的 CandidateBuilder 实例并执行
- [x] 3.2 收集各 Lane 的 buildResult（candidates + signalLog + stats）到 LaneResultsMap

## 4. Merge Engine

- [x] 4.1 创建 `scripts/domain/editorial/merge-engine.mjs`：MergeEngine 类，`merge(laneResults, globalConfig)` 方法
- [x] 4.2 实现 Collect phase：收集所有 Lane 的 candidates，标记 LaneId
- [x] 4.3 实现 minimum_representation policy：非空 Lane 至少贡献 1 条
- [x] 4.4 实现 breaking_override policy：BREAKING Signal 的 Candidate 跨 Lane 优先
- [x] 4.5 实现 final rank + truncate：全局排序（finalRank 降序），截断到 maxSize（默认 40）

## 5. 新 Pipeline Tasks

- [ ] 5.1 创建 `scripts/tasks-editorial/dispatch-lanes.mjs`：DispatchLanes Task，读取 ctx._events，写入 ctx._laneMap + ctx._laneConfigs
- [ ] 5.2 创建 `scripts/tasks-editorial/execute-lanes.mjs`：ExecuteLanes Task，读取 ctx._laneMap，写入 ctx._laneResults
- [ ] 5.3 创建 `scripts/tasks-editorial/merge-candidates.mjs`：MergeCandidates Task，读取 ctx._laneResults，写入 ctx._candidates + ctx._buildResult
- [ ] 5.4 注册三个新 Task 到 run-editorial.mjs 的 TaskRegistry

## 6. Pipeline 集成

- [ ] 6.1 修改 `scripts/pipelines/editorial.mjs`：移除 `BuildCandidates` step，插入 `DispatchLanes → ExecuteLanes → MergeCandidates` 三步
- [ ] 6.2 删除 `scripts/tasks-editorial/build-candidates.mjs`（已被三个新 Task 替代）
- [ ] 6.3 验证 Editorial Pipeline 编译：steps 顺序正确，CurateEvents 继续消费 ctx._candidates

## 7. 测试

- [ ] 7.1 Lane Dispatcher 测试：已知 domain 匹配、未知 domain 降级 fallback、空 events、确定性验证
- [ ] 7.2 Lane Execution 测试：独立构建验证、CandidateBuilder 接口保持
- [ ] 7.3 Merge Engine 测试：基础合并、minimum_representation、breaking_override、空 Lane、所有 Lane 为空
- [ ] 7.4 Pipeline 集成测试：steps 编译正确、ctx 数据流完整
- [ ] 7.5 真实数据回放：用 2026-07-02 的 553 条 Events 运行完整管线，验证 research/industry 分布改善

---

## Post-Implementation Workflow

After completing ALL tasks above, follow this sequence strictly:

1. **Verify**: Run `/opsx:verify` to produce verify.md
2. **User Acceptance**: Present change summary, ask user to confirm the problem is solved
3. **Merge**: After user accepts, go to main branch and merge (must ask user)
4. **Archive**: Run `/opsx:archive` on main
5. **Cleanup**: `git worktree remove .worktrees/change/<name>`

**Iteration**: If user does not accept, analyze the issue and recommend:
fix in place / new change / git reset + stash / git reset / abandon.
