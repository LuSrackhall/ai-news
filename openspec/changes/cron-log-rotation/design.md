## Context

Ingestion 管道的 `updateRunsMd()` 函数位于 `run-ingestion.mjs`，每次运行会向 `data/cron.log` 追加一行 JSON。日志格式为每行一个带 `runId` 的 JSON 对象。

## Goals / Non-Goals

**Goals:**
- append 前检查日期，跨日时重命名当前文件
- 每次轮转后清理超过 7 天的归档

**Non-Goals:**
- 不修改日志格式

## Decisions

**轮转时机：** 在 `updateRunsMd()` 开始时执行，写入新行之前。保证新行始终进入当日日志。
**清理时机：** 轮转后立即清理超过 7 天的 `cron.log.*` 文件。

## Risks / Trade-offs

无显著风险。回滚只需恢复 `run-ingestion.mjs`。
