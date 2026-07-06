# Editorial Intelligence Architecture v2

> 架构文档 — 2026-07-04

---

## 1. Context — 为什么需要 v2

当前 AI Daily 系统在真实运行中暴露出结构性问题：

- 来源严重同质化（36氪/单一源占比高达 68%）
- 非 AI 内容混入（2026-07-04 日报中约 40% 内容与 AI 无关）
- 重磅事件（模型发布、收购、政策）缺乏稳定进入机制
- 跨天重复报道同一事件（70% 的事件集群跨至少 2 天）
- 用户看到的"来源"不是传播链起点（36氪转载自新浪财经，但只标注了 36氪）

这些问题的本质不是"规则不够多"，而是：

> 系统缺乏统一的编辑决策模型（Editorial Decision Model）。

当前系统隐含的是：

```
Score → Sort → Top-N
```

但真实编辑过程是：

```
Evaluate → Decide → Constrain → Compose
```

---

## 2. Paradigm Shift — 从 Ranking 到 Editorial Decision

### 旧模型（Ranking System）

- 所有 Event 进入统一评分空间
- Rule = 权重调整
- Top-N 截断作为最终决策
- 问题表现为"分数不够"

典型问题：
- arXiv 论文因 authority 高获得高分，压制了新闻源的模型发布事件
- 同一来源重复报道同一新闻的不同角度，因分数高被全部保留
- "分数够不够"成为唯一问题，无法解释"为什么没选"

### 新模型（Editorial Decision System）

```
Events
  → Qualification（是否值得报道）
  → Rejection / Acceptance
  → Prioritization（预算约束下排序）
  → Assembly（叙事组织）
```

核心变化：

| 旧 | 新 |
|-|-|
| scoring | decision |
| ranking | prioritization |
| threshold tuning | capability design |
| rule weights | signals |

---

## 3. Capability Map

| Capability | Phase | 回答的问题 |
|-|-|-|
| Judgment | P1 | 哪些事件值得报道？今天优先报道谁？ |
| Memory | P1 | 我们知道什么？这个故事处在什么阶段？ |
| Provenance | P2 | 谁最先说？是否被多源验证？ |
| Assembly | P3 | 如何组织成最有价值的叙事？ |

---

## 4. Core Guardrails（架构护栏）

以下四条为**不可违反的执行约束**，所有实现必须遵守：

- **Judgment decides inclusion, not scoring** — 入选与否是编辑决策，不是分数阈值
- **Memory informs, not decides** — Memory 提供上下文，但不决定事件是否入选
- **Provenance explains, not filters** — Provenance 追溯来源链，但不参与评分或过滤
- **Assembly organizes, not judges** — Assembly 组织内容，但不反向影响哪些内容入选

---

## 5. Judgment Contract

### 5.1 Pipeline Contract

```
Events
  → Qualification
      → QualifiedEvents
      → RejectedEvents
  → Prioritization（budget-aware）
      → PrioritizedCandidates
```

Qualification 不排序。Prioritization 不淘汰。

### 5.2 Qualification（是否进入编辑系统）

**职责**：
- 判断事件是否属于编辑领域（AI / 科技）
- 判断是否具有最低新闻价值

**输出**：
- `QualifiedEvents` — 通过资格评估的事件
- `RejectedEvents` — 被拒绝的事件（含原因）

### 5.3 RejectedEvents（显式拒绝机制）

RejectedEvents 分两类：

**Hard Rejection**（永久排除）：
- 非 AI / 非科技领域内容（纯商业纠纷、娱乐榜单、IPO 新闻等）
- 内容质量低于最低门槛
- 重复或已被 Memory 标记为 stale

**Contextual Rejection**（条件性排除）：
- 当前竞争过高（优秀事件太多，优先级低的被挤出）
- 当日已有更强同类事件
- 可在未来再次进入候选

### 5.4 Prioritization（预算约束排序）

**输入**：
```
QualifiedEvents + Budget（当前：40）
```

**输出**：
```
PrioritizedCandidates（top K under constraints）
```

**约束**：
- Budget 必须显式传入，不允许隐式 top-N 截断
- 不负责过滤（过滤已完成），只负责选择最优组合
- 接口预留分组感知（Assembly 反向要求）

### 5.5 Signals（分层职责）

**Qualification Signals**（影响是否能入选）：

| Signal | 职责 | 来源 |
|-|-|-|
| BreakingSignal | 标记重大新闻，绕过常规过滤 | 现有 BreakingRule（扩展） |
| VerificationSignal | 多源独立确认 = 可信度加分 | Phase 2（Provenance） |
| ContentRelevanceSignal | 判断内容是否属于编辑领域 | 新增 |

**Prioritization Signals**（影响排序位置）：

| Signal | 职责 | 来源 |
|-|-|-|
| EntityHeatSignal | 高热度实体优先（如 OpenAI, DeepSeek） | 现有 ENTITY_WEIGHTS（简化） |
| FreshnessSignal | 更新的事件优先 | 现有 timeliness（保留） |
| TopicSaturationSignal | 同一 topic 已达上限时降权 | 现有 DiversityRule（保留） |
| SourceDiversitySignal | 来源分布约束 | 现有 source_caps（升级） |

---

## 6. Memory Contract（Knowledge Layer）

### 6.1 定位

```
Memory = Advisory Knowledge Layer
NOT authoritative decision system
```

**关键约束**：
- Memory MUST NOT block Qualification
- Judgment MUST work without Memory（冷启动不依赖）
- Memory is advisory only（不作为决策依据）
- Memory Query 是 best-effort，MUST 能降级返回空

### 6.2 职责

Memory 提供：

- **Story Tracking** — 事件发展脉络（如：GPT-6 Day1 发布 / Day2 benchmark / Day4 API）
- **Editorial History** — 历史报道存档（报道了什么、何时报道的）
- **Story Lifecycle** — 故事在编辑生命周期中的阶段
- **Rejected Events Log** — 被拒绝的事件及原因（提供可追溯性）

### 6.3 Judgment ↔ Memory 交互流

```
Event
  → Judgment.Qualification
      → Memory.query(event)
          ← story_age, coverage, lifecycle_state, rejection_history
      → 决策：Qualify / Reject
      → QualifiedEvent → Prioritization
      → RejectedEvent + reason → Memory.log()
  → Judgment.Prioritization（budget-aware）
      → Memory.query(pool)
          ← topic_distribution, entity_coverage
      → 在 budget 内择优
      → PrioritizedCandidates → Pipeline
```

Memory Query 是 best-effort：
- Memory.query(event) → MAY return empty
- Memory 延迟 ≠ Pipeline 延迟
- Memory 故障 ≠ Pipeline 故障

### 6.4 Story Lifecycle

Memory 维护故事状态（实现定义，不在本架构中强制枚举）：

```
Emerging → Developing → Peak → Follow-up → Stale
```

生命周期状态影响：
- `Emerging` → Qualification 优先通过
- `Follow-up` → 降低 Qualification 门槛（读者期待跟进）
- `Stale` → Qualification 降权（无实质更新时压住）

---

## 7. Provenance & Assembly（设计冻结）

### 7.1 Provenance（Phase 2）

**能力输出**（非实现方式描述）：
- **Source Chain** — 一手来源 → 转载链（如：OpenAI Blog → Reuters → TechCrunch → 36氪）
- **First Source Detection** — 谁最先报道
- **Verification Count** — 多源独立确认数量
- **Cross-source agreement graph** — 同一事件被多少独立来源覆盖

**前置条件**（⚠️ 必须在 Phase 2 开工前完成）：
- 当前 ingestion layer 不提供 `original_source` 字段
- 36氪的原始来源标记（如（新浪财经））在 description 纯文本中，未结构化提取
- 虎嗅的原始微信公众号链接在 HTML 中，入库时已被 strip 丢弃
- 需要采集层 schema 升级才能支持完整 source graph

### 7.2 Assembly（Phase 3）

**职责**：
- **Narrative Planning** — 故事分组 + 主题排序 + 章节规划
- **Story Grouping** — 将关联事件组织成专题（如"OpenAI 专题：发布 + API + 融资"）
- **Multi-format Output** — Daily Report / Weekly Digest / Deep Dive / Newsletter / Podcast Script

**⚠️ 接口影响**：Assembly 的 Story Grouping 能力会影响 Judgment.Prioritization 的输出（专题模式下同一主题的多条事件需要同时入选），Judgment 接口必须预留分组感知能力。

---

## 8. Phase 1 Implementation Contract

### 8.1 Scope（实施范围）

| 维度 | 说明 |
|-|-|
| **实现范围** | Judgment（Qualification + Prioritization）+ Memory（Story Tracking + Rejection Log） |
| **不动** | Ingestion pipeline / LLM prompt / Article Generation / RSS source 配置 |
| **验收标准** | 非 AI 内容 < 5%；单源占比 < 35%；模型发布类零漏报（以人工判断为准） |
| **不验收** | 来源多样性优化（那是 Judgment 的自然结果，不是单独 KPI）；跨天去重（那是 Memory 的自然结果） |

### 8.2 Evaluation Mode vs Production Mode

Phase 1 运行在双模式下：

- **Evaluation Mode**：收集指标数据（来源分布、重复率、漏报率），不强制执行生产约束
- **Production Mode**：指标作为硬约束强制执行，失败时输出警告而非阻塞管线

评估模式先运行，确认指标达到验收标准后切换生产模式。

### 8.3 实测发现：来源白名单

测试中发现 ContentRelevanceRule 误判 HuggingFace Blog 的 "🤗 Kernels: Major Updates"（标题过短+含 emoji，命中无 AI 关键词）。需在 ContentRelevanceRule 中添加 SOURCE_WHITELIST，让官方技术源（HuggingFace、OpenAI Blog、Anthropic 等）自动通过 Qualification，不受标题关键词匹配限制。

---

## 9. Current Code Mapping

| 当前代码 | 未来归属 | 动作 |
|-|-|-|
| CandidateBuilder | Judgment.Qualification | Keep |
| BreakingRule | Judgment.Signal（Qualification） | Extend |
| DiversityRule | Judgment.Signal（Prioritization） | Keep |
| RankingPolicy | Judgment.Signal（子信号） | Simplify |
| MergeEngine | Judgment.Prioritization（合并） | Refactor |
| EditorialMemoryRule | Memory（子组件） | Replace |
| DedupPolicy | 废弃（被 Memory 取代） | Remove |

---

## 10. 长期演进：Learning Loop

系统最终演进为：

```
Feedback Loop（post-Phase 3）
        ↓
Judgment ← Memory ← Provenance
        ↓
     Assembly
        ↓
   Publication
        ↓
     Feedback
```

**定位**：
- Feedback 不属于 Capability Layer
- 属于 Meta-System Learning Loop
- 不参与 Phase 1 / Phase 2 / Phase 3 实现

Feedback 回答的问题：
- 我们上一篇日报做得怎么样？
- 读者点击 / 停留 / 反馈如何？
- 人工编辑修正了什么？
- 漏报了什么？误报了什么？

最终形成编辑智能的自改进闭环。

---

## Index

- [Context — 为什么需要 v2](#1-context--为什么需要-v2)
- [Paradigm Shift](#2-paradigm-shift--从-ranking-到-editorial-decision)
- [Capability Map](#3-capability-map)
- [Core Guardrails](#4-core-guardrails架构护栏)
- [Judgment Contract](#5-judgment-contract)
  - [Pipeline Contract](#51-pipeline-contract)
  - [Qualification](#52-qualification是否进入编辑系统)
  - [RejectedEvents](#53-rejectedevents显式拒绝机制)
  - [Prioritization](#54-prioritization预算约束排序)
  - [Signals](#55-signals分层职责)
- [Memory Contract](#6-memory-contractknowledge-layer)
  - [定位](#61-定位)
  - [职责](#62-职责)
  - [Judgment ↔ Memory 交互流](#63-judgment--memory-交互流)
  - [Story Lifecycle](#64-story-lifecycle)
- [Provenance & Assembly（设计冻结）](#7-provenance--assembly设计冻结)
- [Phase 1 Contract](#8-phase-1-implementation-contract)
- [Current Code Mapping](#9-current-code-mapping)
- [长期演进：Learning Loop](#10-长期演进learning-loop)
