## Why

项目文件系统存在两处杂乱：`data/` 下 0 字节废弃 SQLite 文件和 `scripts/domain/editorial/` 下测试文件与生产代码混放。清理后保持目录结构整洁。

## What Changes

- 删除 `data/ai-ribao.db`、`data/ai-news.db`（0 字节，零引用）
- 将 `scripts/domain/editorial/test-*.mjs`（13 个文件）移至 `scripts/tests/`

## Capabilities

### New Capabilities
- `housekeeping-db-cleanup`: 删除废弃的 0 字节 SQLite 文件
- `housekeeping-test-move`: 将测试文件从生产目录移至 `scripts/tests/`

### Modified Capabilities
- （无）

## Impact

- `data/ai-ribao.db` — 删除
- `data/ai-news.db` — 删除
- `scripts/domain/editorial/test-*.mjs`（13 个）→ `scripts/tests/`
