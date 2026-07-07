## Why

实测三期日报暴露两个缺口：跨天重复报道（Meta 算力、千问 Fun-ASR 连续两天出现）和低密度日内容稀薄（7/7 被迫选入弱 AI 相关内容填补席位）。当前 Memory 的 ANNOTATION-only 信号不参与决策，ingestion 的 content_hash 去重仅限同天有效。评估团队审议后确定了 cluster_id 优先匹配、HuggingFace Blog/Tier 1 源补入、FOLLOW_UP 从 -20 降至 -10 的修正方案。

## What Changes

**变更 A — 跨天去重（judgment 修改）：**
- 在 JudgmentEngine 的 Qualification 阶段新增基于 cluster_id（降级：entity）的 Memory 查询
- 匹配到已有覆盖时产出 FOLLOW_UP signal（RANK phase, 可配置权重，默认 -10）
- 3 天内无实质更新时产出 STALE contextual rejection（可被 BREAKING 覆盖）
- 权重通过 config.mjs 的 SIGNAL_WEIGHTS 配置

**变更 B — 低密度日保底（judgment 修改）：**
- QualifiedEvents < 20 时触发补入，从 events.db 查询 HuggingFace Blog + Tier 1 官方博客的未拒绝事件
- 补入上限 10 条，最低 score >= 40 质量门槛
- 补入事件标记 _backfill，在 Prioritization 中获得最低优先级

**前置修复（memory 修改）：**
- 修复 EditorialMemoryRule 与 SqliteMemoryStore 的接口不兼容（.load() 方法缺失）

## Capabilities

### New Capabilities

无。所有修改均在现有 `judgment` 和 `memory` 能力范围内。

### Modified Capabilities

- `judgment`: Qualification 阶段新增 Memory 驱动的跨天去重信号（FOLLOW_UP/STALE）；Prioritization 阶段新增低密度日自动补入机制
- `memory`: 修复 SqliteMemoryStore 与 EditorialMemoryRule 的接口兼容性

## Impact

- **代码改动范围**：judgment-engine.mjs（+Memory 查询 + contextual rejection）、dedup-rule.mjs（新增 Rule）、execute-lanes.mjs（+补入逻辑）、config.mjs（+SIGNAL_WEIGHTS + backfill 配置）、memory-store.mjs（+load 兼容方法）、memory-rule.mjs（适配 SqliteMemoryStore）
- **保留不动**：ingestion pipeline、LLM prompt、render/validate 层、CandidateBuilder、MergeEngine
- **无 Breaking 变化**：所有新增功能通过 JudgmentEngine 的新建配置选项控制，现有行为不受影响
