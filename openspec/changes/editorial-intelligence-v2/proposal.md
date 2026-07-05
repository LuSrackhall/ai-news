## Why

当前 AI Daily 系统在真实运行中暴露出结构性问题：来源高度同质化（36氪单源占比达 68%）、非 AI 内容混入（7/4 日报约 40% 内容与 AI 无关）、重磅模型发布事件缺乏稳定进入机制、跨天重复报道严重。这些问题的本质是系统缺乏统一的编辑决策模型——当前隐含的 `Score → Sort → Top-N` 模式无法区分"什么值得报道"和"今天该排第几"。需要将系统从 Ranking System 升级为 Editorial Decision System，使编辑判断可解释、可追踪、可演进。

## What Changes

引入四个编辑能力层，Phase 1 实现 Judgment + Memory：

**新能力：**
- **Judgment** — 取代当前 CandidateBuilder + Rules + MergeEngine 的混合评分模式。拆分为 Qualification（判断是否入选）和 Prioritization（在预算内排序）两个阶段。Signal 按职责分层（Qualification Signals / Prioritization Signals）。
- **Memory** — 取代当前 DedupPolicy + EditorialMemoryRule 的去重+记忆模式。升级为 Knowledge Layer，提供 Story Tracking、Editorial History、Story Lifecycle、Rejected Events Log。定位为 advisory（非 authoritative），Judgment 查询但不依赖。

**核心架构变化：**
- Qualification 新增显式拒绝路径（RejectedEvents），分 Hard Rejection 和 Contextual Rejection
- Prioritization 将 Budget 作为显式输入
- 引入 Core Guardrails 防止能力腐化
- Current Code Mapping 定义了各模块的 Keep / Extend / Refactor / Replace / Remove 动作

## Capabilities

### New Capabilities

- `judgment`: 编辑判断引擎。将事件从采集层接收后，经过 Qualification（是否值得报道）和 Prioritization（预算约束下排序），输出 PrioritizedCandidates 供后续处理。Signal 按职责分层，不依赖单一评分公式。
- `memory`: 编辑记忆层。提供 Story Tracking（事件发展脉络）、Editorial History（历史报道存档）、Story Lifecycle（故事生命周期状态）、Rejected Events Log（拒绝记录及原因）。Judgment 可在冷启动时无 Memory 工作。

### Modified Capabilities

无。现有 specs（editorial-pipeline、lane-dispatcher、lane-execution、merge-engine）的 spec-level 要求不变。MergeEngine 内部职责重定义但外部 contract 不变。

## Impact

- **代码改动范围**：Judgment Engine 是新代码；Memory Store 是新代码 + 替代 EditorialMemoryRule + 废弃 DedupPolicy
- **保留不动**：Ingestion pipeline、LLM prompt、Article Generation、RSS source 配置
- **Breaking 变化**：DedupPolicy 废弃（被 Memory 取代）；RankingPolicy 从核心评分降级为 Judgment 的一个子信号
- **非 Breaking 变化**：CandidateBuilder 保留但归入 Judgment.Qualification；BreakingRule 保留但扩展信号类型；DiversityRule 保留；MergeEngine 保留但排序职责归 Prioritization
- **新增依赖**：Memory 需要持久化存储（可复用现有 editorial-memory.json 方案升级）
