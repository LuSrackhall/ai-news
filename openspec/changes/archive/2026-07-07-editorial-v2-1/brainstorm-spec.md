# Editorial Intelligence v2.1 — 跨天去重 + 低密度日保底

> 设计文档 — 2026-07-07

---

## Context

三期日报（7/5、7/6、7/7）实测暴露两个缺口：

1. **跨天重复**：Meta 出售算力、千问 Fun-ASR 在连续两天中出现。当前 EditorialMemoryRule 只产出 ANNOTATION 信号（不参与决策），去重依靠 ingestion 阶段的 content_hash + 事件指纹（仅同天有效）。跨天语义去重能力缺失。

2. **低密度日质量下降**：7/7（周日）仅 27 条事件，brief 中被迫选入亿纬锂能电池、造车新势力等弱 AI 相关内容。系统缺乏在内容不足时有控制地补入高质量替代品的机制。

4 人评估团队（架构师 × 主编 × 质疑者 × 工程）审议后，调整为以下方案。

---

## Goals / Non-Goals

**Goals:**
- 跨天去重：同一 cluster 的事件在 N 天内不重复深度覆盖
- 跟踪报道保护：同一实体有实质新进展时不受压制
- 低密度日：合格事件 < 20 时从 HuggingFace Blog、Tier 1 官方博客有质量门槛地补入

**Non-Goals:**
- 不做 entity+topic 联合键去重（质疑者指出不可行，采纳）
- 不做 arXiv 论文补入（Lane 系统已通过 research Lane 处理 arXiv）
- 不改 ingestion pipeline、LLM prompt、渲染层
- 不触及 Memory Advisory 的架构约束（FOLLOW_UP 仅影响排序，STALE 可被 BREAKING 覆盖）

---

## Decisions

### D1: 去重主键使用 cluster_id，entity 为降级

**选择**：Memory 查询优先匹配 cluster_id，无 cluster_id 时降级到 entity 匹配。

**原因**：
- ingestion 阶段的 ClusterEvents 已为事件生成 cluster_id（基于 entity + eventType + keywords 的三重匹配）
- cluster_id 天然解决了"同一事件不同来源"的归并问题
- 质疑者指出 entity+topic 在现有系统中不可构造（events 表无 topic 字段），采纳

**覆盖窗口**：同一 cluster 在 3 天内不重复深度覆盖，7 天内不重复快讯。

### D2: FOLLOW_UP weight 设为 -10 且可配置

**选择**：在 config.mjs 新增 `SIGNAL_WEIGHTS.follow_up = -10`，可通过配置调整。

**原因**：
- 评估团队一致认为 -20 会压死正常跟踪报道
- -10 足以在排序中微调位置，不致命
- BREAKING 事件（+50）不受 -10 影响

### D3: STALE 落地为 contextual rejection（不扩展 FILTER phase）

**选择**：不在 signal.mjs 中新增 phase 语义，在 JudgmentEngine._decideQualification() 中新增 STALE 分支，产出 contextual rejection。

**原因**：
- 架构师指出扩展 resolveFilter() 会增加复杂度
- contextual rejection 可被 BREAKING 信号覆盖（BREAKING 在 _decideQualification 中优先于 STALE 检查）
- 符合 "Memory is advisory" 的架构约束

### D4: 补入源使用 HuggingFace Blog + Tier 1 官方博客，不含 arXiv

**选择**：从 events.db 查询 `source_name IN ('huggingface-blog', 'openai', 'anthropic', 'google-ai-blog', 'deepmind')` 且未被 rejected 的事件，按 rank_total 降序补入。

**原因**：
- 质疑者指出 arXiv 补入是"开历史倒车"（Lane 系统就是为了解决 arXiv 泛滥问题），采纳
- Tier 1 官方博客在低密度日可能已被主窗口覆盖，但作为补入源其质量有保证
- HuggingFace Blog 的内容质量高于 arXiv 论文均值

### D5: 补入触发阈值为 20（非 30）

**选择**：仅在 QualifiedEvents < 20 时触发补入，补入上限 10 条。

**原因**：
- 主编指出 30 在正常运行中几乎不可能触发（research Lane 本身就有数十条 arXiv 论文）
- 20 是产生可读日报的最低数量线
- 7/7 的 27 条虽低于 30 但质量尚可（17 条 curated），说明 30 过于激进

### D6: 前置修复 Memory API 不匹配

**选择**：在执行变更 A 前修复 `EditorialMemoryRule` 与 `SqliteMemoryStore` 的接口不兼容。

**原因**：
- 当前 EditorialMemoryRule 第 25 行调用 `.load()` 方法，该方法仅存在于 `JsonEditorialMemoryStore`，不存在于 `SqliteMemoryStore`
- Memory 从未真正生效（静默降级到 `{ days: {} }`）
- 实施评估将其列为最高优先级前置条件

---

## Risks / Trade-offs

| 风险 | 缓解措施 |
|-|-|
| [cluster_id 匹配] 不同 vendor 的同类事件可能映射到不同 cluster | entity 降级匹配作为回退 |
| [FOLLOW_UP -10] 有价值跟踪报道被微弱压制 | weight 可配置，监控后调整 |
| [补入学质量] HuggingFace Blog 有基础设施公告 | 在 DB 查询时过滤 score >= 40 |
| [补入学不触发] 实际上低密度日不需要补入 | 保持配置可关闭，观察后决定是否删除 |

---

## Migration Plan

1. **修复 Memory API 不匹配**（并行，不改逻辑）
2. **变更 A：跨天去重信号**（judgment-engine.mjs + dedup-rule.mjs）
3. **变更 B：低密度日保底**（config.mjs + execute-lanes.mjs）
4. **全量测试**（新增跨天集成测试 + 低密度日模拟测试）
5. **Evaluation Mode 验证**（跑一期真实日报，确认无退化）
