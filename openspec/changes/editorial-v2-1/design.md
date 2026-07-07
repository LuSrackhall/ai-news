## Context

三期日报实测发现：跨天去重缺失导致 Meta 出售算力、千问 Fun-ASR 在连续两天重复出现；低密度日内容不足导致 7/7 被迫选入亿纬锂能、造车新势力等弱 AI 内容。4 人评估团队审议后确定调整方案。

## Goals / Non-Goals

**Goals:**
- JudgmentEngine.qualify() 中新增 Memory 驱动的跨天去重（cluster_id 优先）
- QualifiedEvents < 20 时从 HuggingFace Blog + Tier 1 官方博客有质量门槛地补入
- 修复 Memory API 不匹配 bug

**Non-Goals:**
- 不做 entity+topic 联合键去重
- 不做 arXiv 论文补入（由 Lane research 通道处理）
- 不改 ingestion、LLM prompt、渲染层

## Decisions

### D1: 去重键使用 cluster_id，entity 降级
Memory 查询优先匹配 cluster_id。3 天内不重复深度覆盖。

### D2: FOLLOW_UP weight = -10 可配置
在 config.mjs 新增 SIGNAL_WEIGHTS 配置节。

### D3: STALE 落地为 contextual rejection
不在 signal.mjs 中新增 phase，JudgmentEngine._decideQualification 中直接处理。

### D4: 补入源 HuggingFace Blog + Tier 1 官方博客
不含 arXiv。最低 score >= 40，补入上限 10 条。

### D5: 触发阈值 20
仅在 QualifiedEvents < 20 时触发保底。

### D6: 前置修复 Memory API
EditorialMemoryRule 调用 .load() 适配 SqliteMemoryStore。

## Risks / Trade-offs

| 风险 | 缓解 |
|-|-|
| cluster_id 匹配粒度 | entity 降级回退 |
| FOLLOW_UP -10 误伤 | 权重可配置 |
| 补入质量 | score >= 40 过滤 |
| 补入不触发 | 配置可关闭 |
