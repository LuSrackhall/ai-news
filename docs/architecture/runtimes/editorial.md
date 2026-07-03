# Editorial Runtime

> Editorial Runtime 是编辑领域的运行时层，负责从 Ingestion 产出的 Event 集合中构建候选池，供 Generation Runtime 使用。
>
> 本文档假设读者已熟悉 `constitution.md` 中的 Layer Model、Runtime Boundary、LLM Boundary 和 Publication Composition。

## Context

当前 Editorial Pipeline 假设所有 Event 可以在同一个编辑空间中排序和筛选。随着 Event 数量增长和来源多样化，这一假设不再成立。

**Evidence**（2026-07-02 实际数据）：

```
553 条 Event 按来源分布：
  Research (arXiv):    365  (66%)
  Industry News:       132  (24%)
  Policy/Other:         56  (10%)
```

在统一的排序空间中，arXiv 论文的数量优势和评分优势（tier 1 权威分 + 学术加分）压倒了所有行业新闻——Candidate Pool 中 90% 为 arXiv 论文，即使 BreakingRule 触发了 304 次保护，也无法改变分布。

根因不是 arXiv 太多，而是**异构信息进入了同一个编辑空间**。一篇 arXiv 技术报告和一篇行业新闻对日报读者的价值不可直接比较，因此不应在同一个排序空间中竞争。

## Goals / Non-Goals

**Goals：**

- 建立 Editorial Runtime 作为独立架构层
- 定义 **Lane（编辑轨道）** 作为一级抽象
- 定义 **Lane Dispatcher** 将 Event 分发到对应 Lane
- 定义 **Editorial Merge** 跨 Lane 合并候选池
- 定义 **Publication Assembly** 产出最终候选池
- 定义 Candidate Builder 在 Runtime 中的 Service 定位

**Non-Goals：**

- 具体 Rule 实现
- Score 阈值调整
- LLM Prompt 改版
- UI 或 API

## Runtime Model

```
Ingestion Runtime
        │
        ▼
   Events (with domain hint)
        │
        ▼
Editorial Runtime
        │
    ├── Lane Dispatcher
    │       │     根据 Event 的 editorialDomain 分发
    │       ▼
    ├── Research Lane            Industry Lane          Policy Lane
    │   ├── LaneContext          ├── LaneContext        ├── LaneContext
    │   ├── Rules (per Lane)     ├── Rules              ├── Rules
    │   ├── CandidateBuilder     ├── CandidateBuilder   ├── CandidateBuilder
    │   └── LanePool             └── LanePool           └── LanePool
    │
    ├── Editorial Merge
    │       │     跨 Lane 合并 → 去重 → 排序 → 截断
    │       ▼
    ├── Publication Assembly
    │       │     应用 Publication 级别的策略
    │       ▼
    └── Candidate Pool (≤ 40)
              │
              ▼
      LLM Curation + Generation
```

### Lane Dispatcher

将 Event 按 `editorialDomain` 字段分配到对应的 Lane。一个 Event 有且仅有一个主 Lane。

当 editorialDomain 无法确定时，优先使用 fallback Lane（如 Industry），并记录日志供后续校准。

### Lane

Lane 是一级编辑轨道。每个 Lane 有独立的：

- **LaneContext**：该 Lane 的配置（maxSize、排序权重、Rule 集合）
- **Rule Pipeline**：该 Lane 内部使用的 Editorial Rules（可复用已有 Rule）
- **Candidate Builder**：在 Lane 内构建候选池

Lane 之间不共享状态，不互相调用。

### Editorial Merge

跨 Lane 合并的策略：

1. 收集各 Lane 的候选池（`LanePool[]`）
2. 按 `finalRank` 跨 Lane 合并排序
3. 应用跨 Lane 约束（如：单 Publication 的 maxSize=40）
4. 产出统一 `Candidate[]`

Merge 不是固定配额。某天某个 Lane 的候选池可以是空的——Merge 不会为此填充，LLM 也会正确 handle 少新闻的情况。

### Publication Assembly

Publication 级别的策略应用：

- 选择哪些 Lane 参与（AI 日报 ≠ 机器人日报）
- 应用 Publication 级别的 Editorial Strategy
- 组装最终 `Candidate[]` 供 LLM 消费

## Candidate Builder 定位

Candidate Builder 是 Editorial Runtime 的一个 Service，不直接面对全部 Event。

```
旧架构：
  553 Events → Candidate Builder → 40 Candidates

新架构：
  553 Events → Lane Dispatcher
    → Research(365) → Candidate Builder → 20 LaneCandidates
    → Industry(132) → Candidate Builder → 15 LaneCandidates
    → Policy(56)    → Candidate Builder → 5  LaneCandidates
    → Editorial Merge → 40 Candidates
```

Candidate Builder 本身不需要修改——它已经支持 Breaking/Diversity/Memory 规则。它的输入从"全部 Events"改为"单 Lane Events"，输出从"final candidates"改为"lane candidates"。

## 与已有代码的关系

| 组件 | 状态 |
|------|------|
| `CandidateBuilder` class | 保持，调用方式不变 |
| `BreakingRule / DiversityRule / MemoryRule` | 保持，可在 Lane 级别配置 |
| `Signal / SignalLog / ResolutionPolicy` | 保持 |
| `BuildCandidates` Task | 升级为 LaneDispatcher + Merge |
| Editorial Pipeline steps | 扩展为 Lane-aware |

## Future Evolution

### Phase 3: Observability + Rule Registry

- 每条 Rule 的输出携带可追溯的 `source` + `reason`（已有 Signal 模型已支持）
- 可视化 Candidate 的"入选原因"：哪条 Rule 提升了它？为什么被 HOLD？
- Rule Registry：Publication 可以通过配置选择启用哪些 Rule

### Phase 3+: AI Editorial Assistant

Editorial Runtime 是确定性层。未来可在其上叠加一个 AI 层，其职责是**建议**而非**决策**：

- 建议调整 Lane 的权重
- 建议今天应该关注哪些领域
- 标记异常的入选/落选模式

AI 层的输出是**建议信号**，不是**排序决定**。最终决策仍由确定性规则和 Merge Policy 控制。

### Long-term: Artifact Expansion

当前 Artifact 类型：article.md、script.md、podcast.mp3。未来可扩展：

- Newsletter（邮件格式）
- HTML 页面（网页日报）
- RSS Feed（自动分发）
- Twitter 线程（社交媒体）
- WeChat 公众号（中文平台）

新增 Artifact 类型 = 新增 RenderPolicy，不需要修改 Editorial Runtime。

---

*Version 1.0 · 2026-07-04*
