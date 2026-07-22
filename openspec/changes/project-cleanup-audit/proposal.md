## Why

项目经过多次迭代后遗留了大量死代码和中间产物，影响代码可维护性和磁盘空间。`scripts/tasks/` 目录包含 10 个零引用的过时任务文件；Ingestion cron 每天产生 4 个从未被消费的中间 JSON（累计 56+ 个文件）；Agent 试错产生了 3 个无用的 `-v2`/`-v3` 目录。这些问题需要一次性清理干净。

## What Changes

- **全量删除 `scripts/tasks/`**：10 个零引用死代码文件，含旧 editorial 管道任务（archive-output, curate-events, generate-article, generate-script, render-artifacts, validate-output）和 4 个过期 ingestion 拷贝
- **停止 Ingestion 中间 JSON 写入**：修改 `collect-assets.mjs` 和 `verify-assets.mjs`，在管道模式下跳过写文件步骤（保留 `collect-rss.mjs` 和 `verify-urls.mjs` 独立 CLI 能力）
- **清理 output/ 残留目录**：删除 `output/production/ai/` 下 `-v2`/`-v3` 后缀目录；删除 `output/YYYY-MM-DD/raw/` 下所有旧中间 JSON
- **更新架构文档**：反映清理后的文件结构

## Capabilities

### New Capabilities
- `cleanup-dead-code`: 删除 `scripts/tasks/` 目录下所有零引用文件
- `cleanup-intermediate-output`: 停止 Ingestion 管道写中间 JSON，清理已有残留
- `cleanup-iteration-residue`: 删除 Agent 试错产生的 `-v2`/`-v3` 目录

### Modified Capabilities
- （无 — 本次不修改任何现有能力的 spec 级别需求）

## Impact

- `scripts/tasks/` — 删除 10 个文件（857 行）
- `scripts/tasks-ingestion/collect-assets.mjs` — 修改：管道下跳过写中间文件
- `scripts/tasks-ingestion/verify-assets.mjs` — 修改：管道下跳过写中间文件
- `output/production/ai/` — 删除 3 个试错目录
- `output/YYYY-MM-DD/raw/` — 删除全部旧中间 JSON（不影响正常功能）
