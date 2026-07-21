## ADDED Requirements

### Requirement: 删除 scripts/tasks/ 目录下所有死代码文件

`scripts/tasks/` 目录下的所有文件均为零引用的死代码，应全量删除。包含：

- `archive-output.mjs` — 旧 editorial 管道归档任务
- `curate-events.mjs` — 旧 editorial 管道选题任务
- `generate-article.mjs` — 旧 editorial 管道文章生成任务
- `generate-script.mjs` — 旧 editorial 管道脚本生成任务
- `render-artifacts.mjs` — 旧 editorial 管道渲染任务
- `validate-output.mjs` — 旧 editorial 管道校验任务
- `collect-assets.mjs` — `tasks-ingestion/collect-assets.mjs` 的过期副本
- `dedup-events.mjs` — `tasks-ingestion/dedup-events.mjs` 的过期副本
- `score-events.mjs` — `tasks-ingestion/score-events.mjs` 的过期副本
- `verify-assets.mjs` — `tasks-ingestion/verify-assets.mjs` 的过期副本

删除前 MUST 再次确认全项目零引用。

#### Scenario: 删除前验证无外部引用
- **WHEN** 执行 `grep -rn "import.*scripts/tasks/" scripts/ --include="*.mjs"`
- **THEN** 输出为空，确认零引用

#### Scenario: 删除后 `node scripts/run-ingestion.mjs` 正常运行
- **WHEN** 删除后运行 Ingestion 管道
- **THEN** 管道正常运行，无 import 报错

#### Scenario: 删除后 `/ai-daily` Skill 正常运行
- **WHEN** SKILL.md 各 step 的脚本命令被执行
- **THEN** 不出现引用 `scripts/tasks/` 的错误
