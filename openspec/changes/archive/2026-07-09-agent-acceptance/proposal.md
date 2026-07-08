## Why

当前验收系统只能检查结构（hook 存在、来源数），无法判断语义质量（头条是否准确、分析是否有深度）。每次修改后需要人工调度 agent 做一次性评审，不可重复。4 人评估团队审议后确定：新增 Agent 驱动的语义评审层，保留最简硬编码，评审为建议性质不阻断发布。

## What Changes

**output-acceptance.mjs 修正：**
- 保留 4 项硬编码检查：hook 存在、editorial 三段完整、来源数 >= 3、deep_items content 字段存在
- 移除字数检查（>= 100 字）和来源集中度阈值（36氪+虎嗅 <= 75%）

**SKILL.md 新增 Step 9（Agent 语义评审）：**
- Agent 通读 article.json、curated.json、article.md
- 5 个维度评分：头条准确度、分析深度、编辑判断、叙事连贯性、来源集中度预警
- 评审结果写入 `output/production/ai/<date>/review.json`

**review.json 消费：**
- `validate-output.mjs compare` 读取 review 摘要纳入基线对比

## Capabilities

### Modified Capabilities

- `judgment`: 移除硬编码字数检查和来源集中度阈值（由 Agent 评审替代）
- `memory`: 不涉及
- `assembly`: 新增 Step 9 Agent 语义评审流程

## Impact

- **改动范围**：output-acceptance.mjs（移除检查项）、SKILL.md（新增 Step 9）、validate-output.mjs（review 摘要纳入基线）
- **不涉及**：ingestion pipeline、LLM prompt、渲染逻辑、CandidateBuilder、MergeEngine
- **已知限制**：自我评审偏差（同一个 Agent 生产又验收，设计文档标注为限制，观察后决定是否隔离）
