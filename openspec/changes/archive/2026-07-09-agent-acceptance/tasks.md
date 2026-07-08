## 1. output-acceptance.mjs 修整

- [x] 1.1 移除 deep_items content 字数检查（>= 100 字）
- [x] 1.2 移除 36氪+虎嗅 <= 75% 硬阈值检查
- [x] 1.3 保留 hook 存在、editorial 三段完整、来源数 >= 3、deep_items 字段存在检查

## 2. SKILL.md Step 9 — Agent 语义评审

- [x] 2.1 在 ai-daily skill 的 Step 6 校验之后、Step 7 合成之前新增 Step 9
- [x] 2.2 Step 9 的 prompt 使用对比/标注范式（5 个维度，temperature=0，引用原文为证据）
- [x] 2.3 Step 9 输出写入 `output/production/ai/<date>/review.json`
- [x] 2.4 review.json 结构：dimensions（name/score/evidence）、improvements、highlights、reviewedAt

## 3. review.json 基线汇总

- [x] 3.1 validate-output.mjs 的 baseline 模式读取 review.json 摘要并计入基线指标
- [x] 3.2 validate-output.mjs 的 compare 模式展示语义评分趋势

## 4. 验证

- [x] 4.1 确认 output-acceptance.mjs 移除了字数检查和来源集中度阈值
- [x] 4.2 手动验证一轮 Agent 评审流程（跑一期日报 + Step 9）
- [x] 4.3 确认 review.json 纳入基线无误
