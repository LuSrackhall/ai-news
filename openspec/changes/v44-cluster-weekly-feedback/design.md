## Context

v4.2 Runtime 已稳定。v4.4 在不改 Runtime 的前提下，通过新增 Task + Pipeline + Schema 扩展架构。

## Goals / Non-Goals

**Goals:** Event 聚类 + 周报 + 反馈收集。算法基础版，骨架完整。

**Non-Goals:** DAG、Learning Engine、多 Pipeline、LLM 聚类。

## Decisions

### D1: 聚类在 Ingestion 阶段执行

```
Collect → Normalize → Verify → ExtractEntities → ClusterEvents → Score → Dedup → Store
```

### D2: 聚类算法 — 三重匹配（满足任一即聚类）

1. 实体重叠度 ≥ 0.5（交集/并集）
2. 事件指纹相同（Entity|EventType|Keywords|Week）
3. 标题 bigram 相似度 ≥ 0.7

### D3: Cluster 标题 = 最高分 Event 标题

v4.4 简化，v4.5+ 用 LLM 生成。

### D4: Weekly Pipeline

```
LoadWeekEvents → AggregateByCluster → GenerateWeeklyArticle → RenderWeekly → ArchiveWeekly
```

### D5: 反馈收集 — 只存不学

feedback 表存原始数据，v4.5 Learning Engine 消费。

### D6: ExtractEntities 增强

匹配范围从 title 扩展到 title + summary。增加 36kr、TechCrunch 等源的中文实体词典。

## Risks

- [聚类太简单] → v4.5 用 LLM 替换
- [实体覆盖率仍不够] → 扩展词典 + summary 匹配
- [Weekly Pipeline 新增复杂度] → 复用 Runtime 框架
