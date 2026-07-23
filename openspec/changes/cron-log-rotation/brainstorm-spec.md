## Context

Ingestion 管道每次运行会向 `data/cron.log` 追加一行 JSON 日志。该文件从无轮转机制，当前已达 648KB / 29766 行，持续增长。

`run-ingestion.mjs` 中的 `updateRunsMd()` 函数读取 `cron.log` 解析历史 JSON 条目生成 `data/runs.md` 表格。日志内容结构为每行一个 JSON 对象，包含 `runId` 字段。

## Goals / Non-Goals

**Goals:**
- 当 `cron.log` 超过阈值时自动轮转，保留最近 N 条记录
- 不影响 `updateRunsMd()` 的正常工作

**Non-Goals:**
- 不修改日志格式（保持每行一个 JSON 对象）
- 不修改 `updateRunsMd()` 的读取逻辑

## Decisions

**Decision 1：日志轮转策略**
- 选择**按日归档**
- 在每次 append 前检查：如果 `cron.log` 的最后修改日期不是今天 → 重命名为 `cron.log.YYYY-MM-DD`，创建新文件
- 保留最近 7 天的归档文件，删除过期归档

**替代方案考虑：**
- 行数截断：简单但丢失早期数据
- 文件大小阈值：可行但不如按日直观

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 归档文件无限累积 | 只保留最近 7 天，自动清理过期 |
| 轮转时机：应在 append 之前还是之后 | append 之前最安全——先轮转再写新行，避免日志进入旧文件 |
