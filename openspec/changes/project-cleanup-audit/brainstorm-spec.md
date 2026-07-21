## Context

项目背景：AI 日报自媒体系统，从 15+ 信源采集 AI 新闻，经 Ingestion（纯代码）→ Editorial（Agent 驱动，/ai-daily 技能）生成日报。

前期迭代中产生了大量遗留问题：

1. **幽灵代码**：Path B（旧 editorial pipeline）的入口文件已删除，但 `scripts/tasks/` 目录下残留 10 个旧任务文件（`archive-output.mjs`, `curate-events.mjs`, `generate-article.mjs`, `generate-script.mjs`, `render-artifacts.mjs`, `validate-output.mjs`, 以及 4 个与 `tasks-ingestion/` 同名的过期拷贝），全项目无任何 import 引用。

2. **Ingestion 中间产物膨胀**：每天 cron 执行的 `run-ingestion.mjs` 在 `output/<date>/raw/` 下写入 `all-raw.json`、`failures.json`、`valid-raw.json`、`url-removed.json`。这些文件从未被下游消费（数据通过 `ctx._assets` 内存传递），只是历史调试遗留。平均每天 4 个文件，已累计 56+ 个文件。

3. **Editorial 试错残留**：`output/production/ai/` 下有 `2026-07-10-v2`、`2026-07-12-v2`、`2026-07-12-v3` 三个 Agent 试错遗留的完整日报目录。

4. **证据截图系统未验证**：`scripts/evidence/collector.mjs`（Playwright 截图）和 SKILL.md Step 2.5 已实现，但从未完整跑通过端到端流程。

约束条件：
- Ingestion cron 在持续运行，修改中间产物逻辑时不能破坏现有采集/入库功能
- 单入口点：`/ai-daily` skill，所有逻辑需围绕此入口组织

## Goals / Non-Goals

**Goals:**
- 删除 `scripts/tasks/` 下所有 10 个死代码文件
- 清理 `output/` 中 Ingestion 中间产物 JSON，改为不写入磁盘或写入后自动清理
- 删除 `output/production/ai/` 下带 `-v2`、`-v3` 后缀的试错残留目录
- 停止 Ingestion 管道继续产生 `output/<date>/raw/` 中间文件
- 所有清理操作经 myspec 流程验证后提交

**Non-Goals:**
- 不修改 Ingestion 采集入库的核心逻辑
- 不新增功能特性
- 不涉及证据截图的端到端验证（可能作为独立事项后续处理）
- 不修改 SKILL.md 或其他 Agent 流程文档

## Decisions

**Decision 1：scripts/tasks/ 直接删除**
- 理由：全项目 grep 无任何 import 引用，且 `scripts/tasks-ingestion/` 已有同功能的最新版本
- 替代方案考虑：逐一确认文件引用 → 成本高且无必要
- 风险：如果误删需要 git 恢复，有 git 历史可回溯

**Decision 2：Ingestion 中间文件两种处理路径**
- 路径 A：修改 Ingestion 管道任务（collect-assets.mjs, verify-assets.mjs），使其不再写中间 JSON
- 路径 B：保留写入逻辑，在管道末尾或归档时清理
- 选择路径 A：更彻底的方案，减少未来 cron 运行的磁盘 I/O。需注意不破坏 `collect-rss.mjs` 和 `verify-urls.mjs` 独立运行的能力（它们可能被手动调用）。

**Decision 3：带 -v2/-v3 后缀的残留目录直接删除**
- 理由：是 Agent 试错的产物，不是正式发布的版本

**Decision 4：output/raw/ 存在性对下游无影响**
- `all-raw.json` 和 `valid-raw.json` 被 `verify-assets.mjs` 等读取过，但修改后回退到 `ctx._assets` 内存数据即可
- 确认过图后，CollectAssets 读取 all-raw.json 后直接返回 `ctx._assets`，VerifyAssets 在没有 valid-raw.json 时的回退逻辑也能正常工作

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 删除 tasks/ 后如果有未发现的引用会报错 | 先 grep 全项目确认零引用，提交前再次验证 |
| Ingestion 管道某步依赖 raw 文件跨步骤传递数据 | 已验证：数据通过 ctx._assets 传递，写 JSON 仅为调试日志 |
| 写入中间文件的代码调用了 mkdirSync、writeFileSync 等副作用 | 修改后 collect-rss.mjs 和 verify-urls.mjs 仍保留独立运行能力（通过 CLI），仅在被管道调用时跳过写文件 |
| git 历史中已跟踪的 output/ 文件被 git 视为 untracked（已在 .gitignore） | 不影响，output/ 已被 .gitignore |
