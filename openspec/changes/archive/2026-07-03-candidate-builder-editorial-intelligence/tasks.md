## 1. Signal 模型与 Resolution Policy

- [x] 1.1 创建 `scripts/domain/editorial/signal.mjs`：定义 EditorialSignal 类型（phase, subtype, weight, source, reason, metadata）、SignalLog 类型
- [x] 1.2 实现 Resolution Policy：FILTER phase 的 BREAKING override + DIVERSITY_CAP HOLD 逻辑、RANK phase 的 +30 boost cap、ANNOTATION phase 的 contextHints 转换
- [x] 1.3 实现 SignalLog.merge()：追加式合并，后执行的 Rule 不覆盖已有 Signal

## 2. EditorialMemoryStore

- [x] 2.1 创建 `scripts/services/editorial-memory-store.mjs`：EditorialMemoryStore 接口定义 + JsonEditorialMemoryStore 实现
- [x] 2.2 实现 load(since)：读取 `data/editorial-memory.json`，返回 MemorySnapshot；文件不存在或损坏时降级返回空对象
- [x] 2.3 实现 save(date, snapshot)：写入 topEventIds（top 5）、topEntities、topCategories
- [x] 2.4 实现 prune(before)：移除 before 日期之前的 DaySnapshot

## 3. Editorial Rules

- [x] 3.1 创建 `scripts/domain/editorial/rules/breaking-rule.mjs`：实体优先级判断（top_tier 实体 + 出现次数 ≤ 2）、官方 Blog 来源 + cluster_size = 1、event_type model_release/acquisition + score ≥ 55
- [x] 3.2 创建 `scripts/domain/editorial/rules/diversity-rule.mjs`：category 分布统计、< 5 类时从 review tier 补入、单 category 上限 8 条、BREAKING 不计入上限
- [x] 3.3 创建 `scripts/domain/editorial/rules/memory-rule.mjs`：查询 MemoryStore、entity/cluster_id 命中标记、连续 2+ 天 contextHint

## 4. CandidateBuilder 引擎

- [x] 4.1 创建 `scripts/domain/editorial/candidate-builder.mjs`：Candidate 类型（event, finalRank, contextHints, signals）、CandidateBuilder 类
- [x] 4.2 实现 build(events, context)：Collect（顺序调用 Rule）→ Filter（应用 FILTER signals）→ Rank（finalRank = score + boost, capped +30）→ Annotate（生成 contextHints）→ Truncate（top 40）
- [x] 4.3 实现 BuildResult 结构（signalLog, filteredIn, filteredOut, rankedCandidates, finalCandidates）
- [x] 4.4 实现 RuleContext 构造：注入 date、memoryStore

## 5. BuildCandidates Task

- [x] 5.1 创建 `scripts/tasks-editorial/build-candidates.mjs`：BuildCandidates Task 类，读取 ctx._events，调用 CandidateBuilder，产出 ctx._candidates + ctx._buildResult
- [x] 5.2 注册 BuildCandidates 到 TaskRegistry

## 6. Pipeline 集成

- [x] 6.1 修改 `scripts/pipelines/editorial.mjs`：在 SelectEditorialWindow 之后插入 `{ taskId: 'BuildCandidates', name: '构建候选池' }` step
- [x] 6.2 修改 `scripts/tasks-editorial/curate-events.mjs`：输入来源从 ctx._events 切换为 ctx._candidates；ctx._candidates 为空时回退到 ctx._events
- [x] 6.3 修改 CurateEvents 的 LLM prompt 适配 Candidate 格式：在输入 JSON 中包含 contextHints 字段

## 7. 测试

- [x] 7.1 BreakingRule 单元测试：top_tier singleton 触发、高频实体不触发、官方 Blog singleton 触发、event_type + score 触发
- [x] 7.2 DiversityRule 单元测试：覆盖不足补入、类别超上限 HOLD、BREAKING 不计入上限
- [x] 7.3 EditorialMemoryRule 单元测试：实体命中、连续天数 contextHint、无命中空返回
- [x] 7.4 CandidateBuilder 集成测试：空 Event 列表、BREAKING override DIVERSITY_CAP、boost cap +30、maxSize 截断
- [x] 7.5 JsonEditorialMemoryStore 测试：load 降级、prune 过期、save/load 往返
- [x] 7.6 验证 Pipeline 编译：BuildCandidates step 正常执行、CurateEvents 消费 ctx._candidates

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
