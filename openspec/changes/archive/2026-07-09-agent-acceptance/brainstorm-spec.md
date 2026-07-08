# Agent-Driven Semantic Acceptance — Agent 语义验收

> 设计文档 — 2026-07-08

---

## Context

当前产出验收有两种方式并存：
1. **硬编码验收**（`scripts/output-acceptance.mjs`）— 检查 hook 存在、来源数、深度内容字段等，阻断性
2. **人工评估**— 调度子 agent 通读日报做语义评审，一次性不重复

问题：人工评估不可重复，硬编码只能检查结构无法判断语义质量。4 人评估团队审议后确认以下方案。

### 评估团队发现
- 质疑者指出：同一 Agent 生产又验收存在自我评审偏差（记录为已知限制）
- 质疑者指出：review.json 需有消费方（评审摘要纳入基线汇总）
- 字数检查移除，保留 content 字段存在性检查

## Goals / Non-Goals

**Goals:**
- 在 SKILL.md 中新增 Step 9：Agent 语义评审
- 评审结果写入 `output/production/ai/<date>/review.json`
- 评审摘要加入基线汇总
- 移除 output-acceptance.mjs 中的字数检查和非必要硬编码

**Non-Goals:**
- 不引入 test 目录（运营评估不推荐）
- 不做 CI 级别的自动阻断（质疑者的"自我评审偏差"问题真实存在，评审保持建议性质）
- 不改动现有 validation-policy.mjs（格式/合规由它负责，不折叠到验收中）

## Decisions

### D1: 保留 4 项硬编码检查，移除字数检查

| 保留 | 原因 |
|------|------|
| hook 存在 | Output Constitution Invariant 3 |
| editorial 三段完整 | Output Constitution Invariant 2 |
| 来源数 >= 3 | Output Constitution Invariant 2 |
| deep_items content 字段存在 | 质疑者发现：移除字数后 content 完全缺失时无兜底 |

| 移除 | 原因 |
|------|------|
| deep_items 字数 >= 100 | 用户要求移除。内容质量交给 Agent 评审 |
| 36氪+虎嗅 <= 75% | 用户/评估团队均认为硬阈值不合理（应通过 Provenance 层解决） |

### D2: Agent 评审作为 SKILL.md Step 9，非嵌入 output-acceptance.mjs

**选择**：评审流程是 Agent 驱动的语义判断，不适合嵌入 Node.js 脚本。改为在 ai-daily skill 中新增 Step 9，Agent 通读产出后输出 review.json。

**原因**：
- 评审需要全文理解能力，Node.js 脚本无法做到
- Agent 在同一会话中做评审存在自我偏差（已知限制），独立脚本调 API 也无法根除
- Step 9 的 timing 在 Step 6（校验）之后、Step 7（合成）之前，评审结果可作为是否继续合成的参考

### D3: review.json 写入 production 目录，review 摘要追加到基线

**路径**：`output/production/ai/<date>/review.json`

**消费路径**：评审写入后，`validate-output.mjs compare` 模式读取 review.json 汇总到 `output/baseline/reviews-summary.json`。基线对比时显示语义评分趋势。

### D4: 评审 prompt 使用"对比/标注"范式

质量架构师建议：不要问 Agent "头条选得好不好"（打分），改为让 Agent 做对比和标注（"列出入选的头条事件 vs 未入选的事件"、"标注 deep_item 是否包含因果分析"）。temperature=0 确保可复现性。

## Risks / Trade-offs

| 风险 | 缓解 |
|-|-|
| [自我评审偏差] 同一个 Agent 生产又验收，不会批评自己 | 记录为已知限制。第一次实施后观察，如果严重则改为独立脚本调 API |
| [review.json 无人消费] 写入后无人关注 | 评审摘要纳入基线对比，compare 时展示趋势 |
| [content 字段存在≠质量好] 仅检查字段存在不保证内容质量 | 时间检查（字数）已移除，内容质量完全依赖 Agent 评审 |
