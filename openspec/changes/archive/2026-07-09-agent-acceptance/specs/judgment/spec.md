## MODIFIED Requirements

### Requirement: Agent Semantic Review

Editorial Pipeline SHALL 在生成日报后执行 Agent 驱动的语义评审，评审结果写入 review.json。

#### Scenario: Semantic review after validation
- **WHEN** Step 6 校验通过
- **THEN** Agent 通读 article.json、curated.json、article.md
- **AND** 从 5 个维度输出评分：头条准确度、分析深度、编辑判断、叙事连贯性、来源集中度预警
- **AND** 评审结果写入 `output/production/ai/<date>/review.json`

#### Scenario: Review result structure
- **WHEN** review.json 写入完成
- **THEN** 每条评审维度必须包含 `name`、`score`（1-5）、`evidence`（引用原文）
- **AND** 必须包含 `improvements` 数组（至少 1 条改进建议）
- **AND** 必须包含 `reviewedBy` 和 `reviewedAt`

### Requirement: Hardened Acceptance Checks

output-acceptance.mjs SHALL 仅保留结构性检查，移除内容质量阈值。

#### Scenario: Structural checks only
- **WHEN** 验收脚本执行
- **THEN** MUST 检查 hook 存在、editorial 三段完整、来源数 >= 3、deep_items content 字段存在
- **AND** MUST NOT 检查 deep_items 字数或 36氪+虎嗅占比阈值
