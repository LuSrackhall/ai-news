## ADDED Requirements

### Requirement: cron.log 按日归档

`run-ingestion.mjs` 在 `updateRunsMd()` 开始处检查 `data/cron.log` 的最后修改日期。
如果最后修改日期 < 今天，则将文件重命名为 `data/cron.log.YYYY-MM-DD` 并重新创建新文件。
轮转后清理超过 7 天的 `data/cron.log.*` 归档文件。

#### Scenario: 跨日首次运行时轮转
- **WHEN** `cron.log` 的最后修改日期是昨天，且是今天的首次运行
- **THEN** `cron.log` 被重命名为 `cron.log.<昨日日期>`，新 `cron.log` 从空文件开始

#### Scenario: 同一日内不轮转
- **WHEN** `cron.log` 的最后修改日期已是今天
- **THEN** 不执行任何轮转操作，直接 append 日志

#### Scenario: 清理过期归档
- **WHEN** 轮转后，存在 `cron.log.*` 文件日期超过 7 天前
- **THEN** 删除这些过期文件，最多保留 7 个归档
