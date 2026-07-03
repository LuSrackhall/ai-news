## ADDED Requirements

### Requirement: Signal Model

系统 SHALL 使用统一的 EditorialSignal 模型表示所有 Editorial Rule 的输出。每条 Signal MUST 包含 phase、subtype、weight、source、reason 字段。Signal 的 phase 值 MUST 是 "FILTER"、"RANK"、"ANNOTATION" 之一。

#### Scenario: Signal 创建
- **WHEN** 一条 Editorial Rule 完成 evaluate()
- **THEN** 返回的 RuleResult 中每项 Signal MUST 包含 phase、subtype、source、reason
- **AND** weight 对于 FILTER 和 ANNOTATION phase 的 Signal MUST 为 0

#### Scenario: Signal 不可变性
- **WHEN** Signal 被 RuleResult 产出后
- **THEN** 后续 Rule 或处理阶段 SHALL NOT 修改该 Signal 的任何字段
