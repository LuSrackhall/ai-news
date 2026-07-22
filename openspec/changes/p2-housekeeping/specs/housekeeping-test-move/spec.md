## ADDED Requirements

### Requirement: 测试文件移入 scripts/tests/

将 `scripts/domain/editorial/test-*.mjs`（13 个文件）移至 `scripts/tests/`，保持文件名和内容不变。

#### Scenario: 测试文件在新路径存在
- **WHEN** 执行 `ls scripts/tests/test-*.mjs`
- **THEN** 返回 13 个文件
