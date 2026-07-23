## Why

`data/cron.log` 持续增长（648KB / 29766 行），无轮转机制。日志有调试价值需要保留，但需要按日归档并自动清理过期归档。

## What Changes

- `run-ingestion.mjs` 在 append 日志前检查日期，跨日时轮转
- 保留最近 7 天的归档文件

## Capabilities

### New Capabilities
- `cron-log-rotation`: cron.log 按日归档，7 天自动清理

### Modified Capabilities
- （无）

## Impact

- `scripts/run-ingestion.mjs` — 追加日志轮转逻辑
- `data/cron.log.YYYY-MM-DD` — 新产生的归档文件（最多 7 个）
