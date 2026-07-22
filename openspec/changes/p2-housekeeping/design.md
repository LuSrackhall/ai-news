## Context

项目 `data/` 目录有两个 0 字节废弃 SQLite；`scripts/domain/editorial/` 下 13 个测试文件与生产代码混放。本次将其清理。

## Goals / Non-Goals

**Goals:**
- 删除废弃 db 文件
- 测试文件移入 `scripts/tests/`

**Non-Goals:**
- 不修改任何文件内容

## Decisions

**Decision 1：测试目标目录 `scripts/tests/`**
- 与 `scripts/tasks-ingestion/`、`scripts/evidence/` 同级
- 不修改 `package.json` 中的测试命令

**Decision 2：删除 db 文件前无需备份**
- git 历史可回溯
- 确认零引用

## Risks / Trade-offs

无。纯文件系统操作。
