## Context

当前系统将编辑判断隐式编码在 CandidateBuilder + Rules + MergeEngine 中，导致三个结构性问题：
1. Qualification 和 Prioritization 混在一个评分公式中（RankingPolicy 的 65+25 公式同时承担过滤和排序职责）
2. 没有显式的拒绝路径（所有事件被"弱接受"后排序截断，非 AI 内容也能进入候选池）
3. 没有编辑记忆层（跨天重复、故事追踪、拒绝原因全靠 LLM 选题时隐式处理）

Phase 1 将 CandidateBuilder 拆解为 Judgment Engine（Qualification + Prioritization），并引入独立的 Memory 层。改动范围限 Editorial Pipeline，不动 Ingestion。

## Goals / Non-Goals

**Goals:**
- 建立 Judgment Engine，将 Qualification 和 Prioritization 拆为独立阶段
- 建立 Memory 层，提供 Story Tracking + Rejected Events Log
- Judgment 和 Memory 之间的 Contract 按架构文档冻结（Memory is advisory, Judgment queries but works without it）
- 所有现有单元测试继续通过
- 非 AI 内容 < 5%；单源占比 < 35%；模型发布零漏报（Evaluation Mode 验收）

**Non-Goals:**
- 不动 Ingestion pipeline、LLM prompt、Article Generation
- 不动 RSS source 配置
- 不动 Provenance（Phase 2）和 Assembly（Phase 3）
- 不引入新的外部依赖
- 不改变输出的文章格式

## Decisions

### D1: Judgment Engine 作为独立模块，不嵌入 CandidateBuilder

**选择**：新建 `scripts/domain/editorial/judgment-engine.mjs`，替代 CandidateBuilder 的职责。

**原因**：
- CandidateBuilder 的 build() 同时做了 collect → filter → rank → annotate → truncate。拆为 Qualification + Prioritization 后，逻辑不兼容现有单一方法
- 独立模块更容易扩展新的 Signal 类型，不需要修改现有 Rule 接口
- CandidateBuilder 代码保留（作为参考），但 Editorial Pipeline 改为调用 Judgment Engine

**替代方案**：在 CandidateBuilder 内部增加阶段开关。否决，因为阶段开关导致 if-else 膨胀，且无法独立测试 Qualification 和 Prioritization。

### D2: Signal 系统保持现有 EditorialSignal 模型

**选择**：复用 `signal.mjs` 的 EditorialSignal 模型（phase / subtype / weight / source / reason / metadata），不新增 Signal 类型系统。

**原因**：
- 现有 Signal 模型已经支持 FILTER / RANK / ANNOTATION 三阶段，与 Qualification / Prioritization 映射自然
- Qualification Signals → FILTER phase（控制是否入选）
- Prioritization Signals → RANK phase（控制排序位置）
- 不需要额外抽象层

### D3: Memory 使用 SQLite，不继续用 JSON 文件

**选择**：使用已有 `data/events.db` 的 SQLite 数据库，新建 `editorial_memory` 表，不继续使用 `editorial-memory.json` 文件。

**原因**：
- 现有 JsonEditorialMemoryStore 的 JSON 文件方式在并发写入时有竞态风险（read-modify-write 非原子）
- 同一进程已有 better-sqlite3 依赖
- SQLite 支持原子写入、条件查询、分页，适合 Story Tracking 和 Lifecycle 查询
- 迁移路径：JsonEditorialMemoryStore 继续保留作为降级实现，SQLiteMemoryStore 作为默认实现

### D4: DedupPolicy 废弃，由 Memory 替代

**选择**：DedupPolicy 及其使用的 TitleSimilarityRule 和 EventFingerprintRule 标记为废弃。

**原因**：
- DedupPolicy 只做同一天内容级去重（URL 精确匹配 + 事件指纹 + 标题相似度），无法处理跨天故事级重复
- Memory 的 Story Tracking 可以覆盖去重功能，同时提供更多上下文
- 代码保留但 Editorial Pipeline 不再引用

### D5: MergeEngine 保留但职责重定义

**选择**：MergeEngine 保留其合并候选池和 Policy 职责，但排序职责剥离到 Prioritization。

**原因**：
- MergeEngine 的 `executeLanes` 和 `merge` 方法不需要修改
- Prioritization 在 MergeEngine 输出之上做全局排序 + budget 截断
- 现有 Merge Policy（minimum_representation / breaking_override）保留在 MergeEngine 中

### D7: 来源白名单机制（ContentRelevanceRule 补充）

**选择**：在 ContentRelevanceRule 中添加 SOURCE_WHITELIST，HuggingFace Blog、OpenAI Blog、Anthropic 等官方技术源的标题即使因过短/含 emoji 未命中 AI_TECH_KEYWORDS，也自动通过 Qualification。

**原因**：
- 测试发现 HuggingFace 官方博客的 "🤗 Kernels: Major Updates" 因标题过短且含 emoji 被误判为非 AI 内容
- 官方技术源的内容相关性有编辑先验保证，无需依赖标题匹配
- 白名单覆盖 Tier 1 官方源和核心科技媒体，易于维护扩展

**选择**：RankingPolicy 不再作为独立评分入口，其规则（authority / timeliness / verifiability / content_quality）整合为 Judgment 的 Qualification Signals。

**原因**：
- RankingPolicy 当前的 65+25 公式在 Qualification 阶段仍有用（作为相关性判断的参考信号之一）
- 不再需要"评分 → 分 tier → skip / review / auto"的流程
- Qualification 直接输出 QualifiedEvents / RejectedEvents，不再需要 tier 标签

## Risks / Trade-offs

| 风险 | 缓解措施 |
|-|-|
| [Memory 持久化] SQLite 写入失败可能导致 Memory 不可用 | Judgment MUST 在 Memory 无响应时正常工作；Memory 提供 Json 降级 |
| [信号过载] 新增多个 Qualification Signal 后决策逻辑复杂化 | Signal 按优先级链式评估（先检查 Hard Rejection，再检查 Breaking 等），避免并行投票 |
| [Budget 泄露] 优先化时 Budget 约束绕过（如 protected 项溢出） | Budget 在 Prioritization 入口强制校验，不允许超限 |
| [迁移期间] 现有测试依赖 RankingPolicy 的评分行为 | Judgment Engine 在 Evaluation Mode 下并行输出新旧结果对比 |
| [生命周期状态] Story Lifecycle 状态机边界模糊 | 状态机在 Memory 实施文档中定义，允许后续调整 |
| [来源白名单] WHITELIST 漏加新源时可能导致误拒绝 | ContentRelevanceRule 的 evaluate 在不命中白名单时仍走关键词检查，双重保障 |

## Migration Plan

1. **新增 Judgment Engine 模块**（并行，不删除旧代码）
2. **新增 SQLiteMemoryStore**（并行）
3. **Editorial Pipeline 切换**：将 CandidateBuilder 调用替换为 Judgment Engine 调用
4. **Evaluation Mode**：新旧路径并行运行，对比输出
5. **废弃 DedupPolicy**：Pipeline 中移除 dedup 步骤引用
6. **RankingPolicy 降级**：Pipeline 不再调用 RankingPolicy，其规则作为子信号注册
7. **Production Mode**：切换为 Judgment Engine 作为唯一路径，旧代码保留但不执行
