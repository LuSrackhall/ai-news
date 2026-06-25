## ADDED Requirements

### Requirement: Editorial Runtime SHALL run as pure Node.js

Editorial 通过 `node scripts/run-editorial.mjs` 运行，`/daily` 作为 Skill 别名。

#### Scenario: 手动运行
- **WHEN** 执行 `node scripts/run-editorial.mjs --date 2026-06-24`
- **THEN** 从 SQLite 读取指定日期的 Event，执行 7 个 Task，产出 article.md + script.md

#### Scenario: 默认时间窗口
- **WHEN** 不指定 --date 参数
- **THEN** 默认查询昨天 08:00 到今天 08:00 的 Event

### Requirement: SelectEditorialWindow SHALL query by effective_at

Editorial 读取 Event 时基于 effective_at，不是 collected_at。

#### Scenario: 正常查询
- **WHEN** SelectEditorialWindow 执行
- **THEN** 查询 `effective_at >= yesterday_08:00 AND effective_at < today_08:00`，返回 Event[]

### Requirement: Editorial output SHALL write to output/<date>/

#### Scenario: 正常产出
- **WHEN** Editorial Runtime 完成
- **THEN** output/<date>/ 目录包含 article.md、script.md、article.json、script.json、execution.json
