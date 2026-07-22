## Context

项目在多次迭代后，遗留了两类文件系统杂乱：
1. `data/` 目录下有两个 0 字节的废弃 SQLite 文件（`ai-ribao.db`、`ai-news.db`），无人使用，仅在 `.gitignore` 中
2. `scripts/domain/editorial/` 目录下混入了 13 个测试文件（`test-*.mjs`），与 11 个生产文件同目录，约 106KB

当前架构已规范为 `scripts/tasks-ingestion/` 和 `scripts/evidence/` 等职责分明的子目录，测试文件也应当有独立位置。

## Goals / Non-Goals

**Goals:**
- 删除 `data/ai-ribao.db`、`data/ai-news.db`（0 字节废弃文件）
- 将 `scripts/domain/editorial/test-*.mjs` 移至 `scripts/tests/`
- 保持迁移后所有文件内容不变

**Non-Goals:**
- 不修改任何测试文件内容
- 不添加新的测试
- 不修改生产代码

## Decisions

**Decision 1：直接删除 vs 保留备份**
- 选择直接删除。两个 `.db` 文件为 0 字节，确认无任何代码引用，git 历史可回溯
- 保留 `.gitignore` 中 `*.db` 规则不变

**Decision 2：测试目录结构**
- 目标路径 `scripts/tests/`（与 `scripts/tasks-ingestion/`、`scripts/evidence/` 同级）
- 不移入 `tests/` 项目根目录（保持领域关联性）

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 删除的 db 文件被某个自动化脚本隐式依赖 | 已 grep 全项目确认零引用 |
| 测试脚本内部有相对路径引用 | 文件内容不修改，相对路径引用关系不变 |
