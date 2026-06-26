# v4.4 — Event 聚类 + 周报 + 反馈收集

## Context

v4.2 建立了 Dual Runtime（Ingestion + Editorial）+ SQLite Event Repository。数据模型已预留 `entities`、`topics`、`cluster_id` 字段，但聚类、周报、反馈能力尚未实现。

v4.4 的目标是：**在不改 Runtime 的前提下，通过新增 Task + 新增 Pipeline + 扩展 Schema，把架构提升到最高上限。** 算法可以是基础版，但骨架必须完整。

### 用户原则

> "先把整个框架打起来，再慢慢调。Runtime 边界设计是现在最昂贵的事，算法以后都能换。"

## Goals / Non-Goals

**Goals（v4.4）：**
- SQLite Schema 扩展（event_clusters + weekly_reports + feedback）
- 实体提取增强（regex title + summary + 词典，覆盖率 7% → 30%+）
- 事件聚类（规则聚类：实体重叠度 ≥ 阈值）
- 聚类后 Event 构建（N Event → 1 Cluster，保留多源信息）
- Weekly Pipeline（读取 7 天 Event，按 Cluster 聚合，生成周报）
- 反馈数据收集（feedback 表 + 基础写入接口）
- 版本文档（docs/versions/v4.4.md）

**Non-Goals（明确排除）：**
- LLM 辅助实体提取（v4.5+）
- LLM 辅助聚类（v4.5+）
- DAG 并行调度（v4.5）
- Learning Engine / 自动调整权重（v4.5）
- 多 Pipeline（Newsletter/视频脚本）（v4.5）
- 增量生成（v4.5）

## Decisions

### D1: 聚类时机 — Ingestion 阶段

聚类在 Ingestion 的 ExtractEntities 之后、ScoreEvents 之前执行。这样评分时已经知道 Event 属于哪个 Cluster，可以按 Cluster 维度做去重和排序。

```
Collect → Normalize → verify → extractEntities → clusterEvents → score → dedup → store
```

### D2: 聚类算法 — 实体重叠度

两个 Event 属于同一 Cluster 的条件（满足任一）：
1. 实体重叠度 ≥ 0.5（两个 Event 的 entity 交集 / 并集）
2. 事件指纹相同（Entity|EventType|TopKeywords|Week，复用 v3 dedup 的逻辑）
3. 标题 bigram 相似度 ≥ 0.7（比 dedup 的 0.5 更严格）

v4.4 用规则，v4.5+ 可替换为 LLM 聚类。

### D3: Cluster 标题生成 — 取最高分 Event 的标题

v4.4 简化：Cluster 标题 = 该 Cluster 中 rank_total 最高的 Event 的标题。v4.5+ 可用 LLM 生成更好的标题。

### D4: Weekly Pipeline — 新增 Pipeline

```
LoadWeekEvents → AggregateByCluster → GenerateWeeklyArticle → GenerateWeeklyScript → RenderWeekly → ArchiveWeekly
```

触发：每周日 / 手动。输入：最近 7 天 Event。输出：`output/weekly/<week>/`。

### D5: 反馈收集 — 基础写入接口

v4.4 只做数据收集，不做学习。feedback 表存储原始反馈数据（click/read_time/share/rating），v4.5 的 Learning Engine 消费这些数据。

### D6: Ingestion Task 序列变化

```
v4.2: Collect → Normalize → Verify → ExtractEntities → Score → Dedup → Store
v4.4: Collect → Normalize → Verify → ExtractEntities → ClusterEvents → Score → Dedup → Store
```

新增 `ClusterEvents` Task，插入在 ExtractEntities 之后、Score 之前。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 聚类算法太简单，聚类质量低 | v4.4 先跑通骨架，v4.5 用 LLM 替换 |
| 实体提取覆盖率仍不够 | 扩展词典 + 匹配 summary，目标 30%+ |
| Weekly Pipeline 新增复杂度 | 复用 Ingestion/Editorial 共用的 Runtime 框架 |
| 反馈数据没有消费者 | v4.5 的 Learning Engine 消费，v4.4 只收集 |
