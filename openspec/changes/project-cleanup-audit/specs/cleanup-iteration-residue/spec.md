## ADDED Requirements

### Requirement: 删除 Agent 试错残留的 -v2/-v3 目录

`output/production/ai/` 下存在 Agent 多次试错生成的正式目录，应全量删除：

- `2026-07-10-v2` — 含 article.json/article.md/curated.json/script.json/script.md/review.json
- `2026-07-12-v2` — 同上
- `2026-07-12-v3` — 含 article.json/article.md/curated.json/script.json/script.md

仅删除带 `-v2`/`-v3` 后缀的目录，保留不带后缀的正式版本（如 `2026-07-10`、`2026-07-12`）。

#### Scenario: 仅删除带后缀的目录
- **WHEN** 执行 `rm -rf output/production/ai/*-v2 output/production/ai/*-v3`
- **THEN** `output/production/ai/2026-07-12/` 等正式目录不受影响
- **THEN** `2026-07-12-v2/`、`2026-07-12-v3/` 等目录被删除
