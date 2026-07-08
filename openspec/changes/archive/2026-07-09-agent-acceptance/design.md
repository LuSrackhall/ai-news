## Context

4 人评估团队审议确定：保留 4 项硬编码结构性检查，移除字数检查和来源集中度阈值，新增 Agent 语义评审作为 SKILL.md Step 9。

## Goals / Non-Goals

**Goals:**
- SKILL.md 新增 Step 9：Agent 语义评审
- review.json 写入 production 目录，评审摘要纳入基线
- output-acceptance.mjs 移除 2 项非必要硬编码

**Non-Goals:**
- 不引入 test 目录
- 不做 CI 级自动阻断
- 不改现有 validation-policy.mjs

## Decisions

### D1: 保留 4 项硬编码检查
hook 存在、editorial 三段完整、来源数 >= 3、deep_items content 字段存在。移除字数和来源集中度阈值。

### D2: Agent 评审作为 SKILL.md Step 9
在 Step 6（校验）之后、Step 7（合成）之前。评审结果为建议性，写入 review.json。

### D3: review.json 写入 output/production/ai/<date>/review.json
评审摘要由 validate-output.mjs compare 汇总。

### D4: 评审 prompt 使用对比/标注范式
避免直接打分，改为比较和标注任务。
