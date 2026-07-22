## Context

当前 Ingestion 管道 (`run-ingestion.mjs`) 的 `CollectAssets` 和 `VerifyAssets` 任务通过 `execSync` 调用独立的 CLI 脚本 (`collect-rss.mjs`、`verify-urls.mjs`)。这些 CLI 脚本除了完成本职工作外，还会向 `output/<date>/raw/` 写入调试用的中间 JSON 文件。管道本身并不消费这些文件——数据通过 `ctx._assets` 对象在任务间传递。

`scripts/tasks/` 目录在 Path B 清理时被遗漏，成为零引用死代码。

## Goals / Non-Goals

**Goals:**
- 管道执行时不再写中间 JSON（独立 CLI 调用仍可写）
- 删除 `scripts/tasks/` 下 10 个文件
- 清理已有中间产物和试错目录

**Non-Goals:**
- 不修改 `collect-rss.mjs` 或 `verify-urls.mjs` 的独立 CLI 行为
- 不修改 Ingestion 管道的任何核心数据逻辑
- 不涉及证据截图的全流程验证

## Decisions

**Decision 1：管道模式 vs CLI 模式的分离策略**

不在 CLI 脚本中添加参数判断，而是在 Task 的 `execute()` 方法中做处理。因为 `CollectAssets` 和 `VerifyAssets` 是通过 `execSync` 调用 CLI 的，我们有两种方案：

- **方案 A**：给 CLI 脚本加 `--no-write` 参数，管道调用时传入
- **方案 B**：在 Task 的 `execute()` 中，读取 CLI 的输出后直接删除刚写的文件

选择方案 A。原因：方案 B 存在竞态——如果管道中途崩溃，文件不会被清理；方案 A 更干净，从源头避免写盘。同时保留 CLI 独立运行时的写盘能力（用户手动调试时需要）。

**Decision 2：collect-rss.mjs 的修改方式**

`collect-rss.mjs` 末尾（约 L609-620）有一段写 `failures.json` 的逻辑。添加 `--no-write` 参数，当传入时跳过 `writeFileSync` 和 `mkdirSync`。

**Decision 3：verify-urls.mjs 的修改方式**

`verify-urls.mjs` 末尾写 `valid-raw.json` 和 `url-removed.json`。添加 `--no-write` 参数，当传入时跳过写文件。

**Decision 4：collect-assets.mjs 和 verify-assets.mjs 的修改方式**

在 `execSync` 命令中添加 `--no-write` 参数即可，Task 本身逻辑无需改动。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| `--no-write` 参数被忘记在非管道调用时传入 | 默认为 write（兼容现有行为），仅管道传入 `--no-write` |
| `collect-assets.mjs` 依赖 `rawPath` 读取 `all-raw.json` | 它读的是已写好的文件，而 CLI 脚本在 `--no-write` 下不写 `failures.json`，`all-raw.json` 仍然写入——`collect-rss.mjs` 的 `all-raw.json` 写盘逻辑和 `failures.json` 写盘逻辑是分开的 |
| 未来其他任务可能依赖 raw 文件 | 目前全项目搜索 `output/*/raw/` 的读取只有 `collect-assets.mjs` 和 `verify-assets.mjs` |
