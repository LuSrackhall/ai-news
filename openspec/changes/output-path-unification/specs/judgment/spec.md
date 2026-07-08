## MODIFIED Requirements

### Requirement: Unified Output Path

所有 AI 日报产出文件 MUST 写入 `output/production/ai/<date>/` 目录。

#### Scenario: Pipeline archive writes to new path
- **WHEN** Editorial Pipeline 完成归档
- **THEN** article.json、curated.json、article.md 等产出文件 MUST 在 `output/production/ai/<date>/` 目录下

#### Scenario: Validation reads from new path
- **WHEN** 验收脚本读取报道产出
- **THEN** 默认从 `output/production/ai/<date>/` 读取 article.json、article.md、curated.json
- **AND** 确保 article.json 和 article.md 的读取路径一致

#### Scenario: Agent follows SKILL.md
- **WHEN** Agent 按 ai-daily skill 执行 Steps 5-8
- **THEN** 渲染、校验、归档的内联代码 MUST 与 Steps 2-4 使用相同的 `output/production/ai/<date>/` 路径
