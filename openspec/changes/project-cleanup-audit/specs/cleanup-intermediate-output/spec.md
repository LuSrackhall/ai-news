## ADDED Requirements

### Requirement: 管道模式下停止写中间 JSON 文件

Ingestion 管道的 `CollectAssets` 和 `VerifyAssets` 任务在通过 `execSync` 调用 CLI 脚本时，需传入 `--no-write` 参数，使 CLI 脚本跳过写入 `output/<date>/raw/` 下的调试文件。

#### Scenario: 管道调用 collect-rss.mjs 时传入 --no-write
- **WHEN** `CollectAssets.execute()` 调用 `node scripts/collect-rss.mjs --date <date> --no-write`
- **THEN** CLI 不创建 `output/<date>/raw/failures.json`，但仍输出 `all-raw.json`

#### Scenario: 管道调用 verify-urls.mjs 时传入 --no-write
- **WHEN** `VerifyAssets.execute()` 调用 `node scripts/verify-urls.mjs --date <date> --no-write`
- **THEN** CLI 不创建 `output/<date>/raw/valid-raw.json` 和 `output/<date>/raw/url-removed.json`

#### Scenario: CLI 独立调用不传 --no-write 时仍写入
- **WHEN** 手动运行 `node scripts/collect-rss.mjs --date <date>`（无 `--no-write`）
- **THEN** 仍正常写入 `failures.json`（向后兼容）

#### Scenario: CLI 独立调用传 --no-write 时跳过写入
- **WHEN** 手动运行 `node scripts/collect-rss.mjs --date <date> --no-write`
- **THEN** 不写入 `failures.json`，仅输出到 stdout

### Requirement: 清理已有中间 JSON 文件

删除所有 `output/<date>/raw/` 目录下的 JSON 中间文件（`all-raw.json`、`failures.json`、`valid-raw.json`、`url-removed.json`），保留空目录或删除整个 `raw/` 目录。

#### Scenario: 删除旧中间文件
- **WHEN** 执行清理命令
- **THEN** 所有 `output/YYYY-MM-DD/raw/*.json` 被删除（56+ 个文件）
