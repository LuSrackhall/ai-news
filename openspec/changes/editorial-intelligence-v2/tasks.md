## 1. Memory Store — SQLite 实现

- [x] 1.1 新增 `scripts/domain/editorial/memory-store.mjs`，实现 SqliteMemoryStore 类（基于 better-sqlite3）
- [x] 1.2 创建 `editorial_memory` 表 schema（含 stories、lifecycle_states、rejected_events、day_snapshots 表）
- [x] 1.3 实现 Story Tracking：记录事件实体/主题的时间线，支持按实体和按时间范围查询
- [x] 1.4 实现 Editorial History：替换现有 JsonEditorialMemoryStore，支持 DaySnapshot 的保存和查询
- [x] 1.5 实现 Story Lifecycle：状态机接口（查询 / 更新生命周期状态）
- [x] 1.6 实现 Rejected Events Log：记录被拒绝的事件 ID、原因、类型（Hard/Contextual）、时间
- [x] 1.7 实现 MemoryStore 降级：Connection 失败时返回空结果，不抛出异常
- [x] 1.8 MemoryStore 单元测试（story tracking / lifecycle / rejection log / 冷启动 / 并发写入）

## 2. Judgment Engine — 核心模块

- [x] 2.1 新增 `scripts/domain/editorial/judgment-engine.mjs`，实现 JudgmentEngine 类
- [x] 2.2 实现 Qualification 阶段：接收 Events + Memory query，输出 QualifiedEvents + RejectedEvents
- [x] 2.3 实现 Prioritization 阶段：接收 QualifiedEvents + Budget，输出 PrioritizedCandidates
- [x] 2.4 实现 ContentRelevanceSignal：判断事件内容是否属于 AI / 科技编辑领域
- [x] 2.5 实现 Evaluation Mode：收集指标（来源分布、拒绝分布、入选率），不强制执行约束
- [x] 2.6 实现 Production Mode：指标作为硬约束强制执行
- [x] 2.7 JudgmentEngine 单元测试（Qualification / Prioritization / RejectedEvents / Evaluation Mode / 冷启动）

## 3. Signal 整合与连线

- [x] 3.1 将现有 BreakingRule 整合为 Judgment.Qualification 的 BreakingSignal：移除评分门槛，所有 model_release/acquisition 事件无条件产出 BREAKING signal
- [x] 3.2 将现有 DiversityRule 保留为 Prioritization 的 TopicSaturationSignal（不变）
- [x] 3.3 从现有 RankingPolicy 解耦 authority / timeliness / verifiability / content_quality 规则，注册为 Qualification 的子信号
- [x] 3.4 新增 SourceDiversitySignal：来源分布约束（从现有 source_caps 升级，不在硬编码阈值）
- [x] 3.5 新增 EntityHeatSignal：从现有 ENTITY_WEIGHTS 简化为 Prioritization 信号
- [x] 3.6 新增 FreshnessSignal：从现有 timeliness 简化为 Prioritization 信号

## 4. Pipeline 集成

- [ ] 4.1 Editorial Pipeline 中引入 JudgmentEngine 实例化管理
- [ ] 4.2 DispatchLanes task 输出直接接入 JudgmentEngine.Qualification（替代候选构建前的评分检查）
- [ ] 4.3 ExecuteLanes task 中 JudgmentEngine.Prioritization（替代 CandidateBuilder 的 top-N 截断）
- [ ] 4.4 MergeCandidates task 剥离排序职责，只做 Lane 合并 + Merge Policy（minimum_representation / breaking_override）
- [ ] 4.5 CurateEvents task 的输入源切换到 PrioritizedCandidates（而非 CandidateBuilder 输出）
- [ ] 4.6 废弃 DedupPolicy：从 Editorial Pipeline 中移除 dedup 引用，代码保留但不执行
- [ ] 4.7 废弃 RankingPolicy 的独立评分路径：Pipeline 不再调用 RankingPolicy，其规则注册为子信号

## 5. 集成测试与验证

- [ ] 5.1 Judgment Engine + MemoryStore 集成测试（完整 Qualification → Prioritization 链路）
- [ ] 5.2 Evaluation Mode replay 测试：用历史数据跑新路径，对比输出差异
- [ ] 5.3 验收指标验证：非 AI 内容 < 5%；单源占比 < 35%；模型发布零漏报
- [ ] 5.4 确认所有现有单元测试继续通过（CandidateBuilder、MergeEngine、BreakingRule 等未删除代码的测试）
- [ ] 5.5 编写 JudgmentEngine 和 MemoryStore 的文档/README 注释

## Post-Implementation Workflow

<!-- DO NOT MODIFY THIS SECTION — it defines the required workflow after all tasks are complete -->

After completing ALL tasks above, follow this sequence strictly:

1. **Verify**: Run `/opsx:verify` to produce verify.md
2. **User Acceptance**: Present change summary, ask user to confirm the problem is solved
3. **Merge**: After user accepts, go to main branch and merge (must ask user)
4. **Archive**: Run `/opsx:archive` on main
5. **Cleanup**: `git worktree remove .worktrees/change/<name>`

**Iteration**: If user does not accept, analyze the issue and recommend:
fix in place / new change / git reset + stash / git reset / abandon.
