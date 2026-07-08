## Why

当前代码库中存在至少 3 种不同的输出路径策略在同时运行，且同一个脚本（validate-output.mjs）内部存在路径矛盾的 bug。评估团队认定路径不统一是产出质量控制的**最大阻塞项**——验收脚本读不到 pipeline 写入的文件。

## What Changes

统一所有产出路径到 `output/production/ai/<date>/`：

- `scripts/tasks-editorial/archive-output.mjs` — 路径替换
- `scripts/tasks/archive-output.mjs` — 路径替换
- `scripts/tasks-weekly/archive-weekly.mjs` — 路径替换
- `scripts/tasks/score-events.mjs` — 路径替换
- `scripts/validate-output.mjs` — **修复 bug**（article.md 路径硬编码未使用 OUTPUT_DIR）
- `scripts/render-article.mjs` — 确认路径已正确
- `scripts/output-acceptance.mjs` — 确认路径已正确
- `.claude/skills/ai-daily/skill.md` — Steps 5/6/8 内联代码路径同步
- `scripts/domain/editorial/test-replay.mjs` — 添加新候选路径
- `scripts/storage/json-file-storage.mjs` — 改默认值

## Capabilities

### Modified Capabilities

- `judgment`: 输出路径标准化，不影响 Judgment 逻辑
- `memory`: 输出路径标准化，不影响 Memory 逻辑

## Impact

- **改动量**：约 22 行，11 个文件（纯路径字符串替换 + validate-output bug 修复）
- **不涉及**：Ingestion pipeline、LLM prompt、渲染逻辑、评分逻辑
- **不删除**：旧 `output/` 目录数据（gitignored，保留）
- **不强制**：不要求所有脚本 import output-config.mjs
