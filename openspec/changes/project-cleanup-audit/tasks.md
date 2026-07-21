## 1. 审计复核：验证全项目引用状态

- [x] 1.1 使用子 Agent 执行全项目 grep 确认 `scripts/tasks/` 零引用
- [x] 1.2 确认 `collect-rss.mjs` 和 `verify-urls.mjs` 的 CLI 独立运行时是否写中间文件

## 2. 修改 Ingestion 管道：跳过中间 JSON

- [x] 2.1 修改 `scripts/collect-rss.mjs`：添加 `--no-write` 参数支持，传参时跳过 `failures.json` 写入（`all-raw.json` 保持写入，因为下游读取依赖它）
- [x] 2.2 修改 `scripts/verify-urls.mjs`：添加 `--no-write` 参数支持，传参时跳过 `valid-raw.json` 和 `url-removed.json` 写入
- [x] 2.3 修改 `scripts/tasks-ingestion/collect-assets.mjs`：`execSync` 中添加 `--no-write`
- [x] 2.4 修改 `scripts/tasks-ingestion/verify-assets.mjs`：`execSync` 中添加 `--no-write`
- [x] 2.5 使用子 Agent 审计修改后的代码，确认管道模式不写中间文件、CLI 独立模式保持向后兼容

## 3. 删除死代码

- [x] 3.1 使用子 Agent 二次确认后，删除 `scripts/tasks/` 目录下全部 10 个文件
- [x] 3.2 运行 `node scripts/run-ingestion.mjs --date 2026-07-22` 确认管道正常运行（可以 timeout，只要不报 import 错误）

## 4. 清理 output/ 残留

- [x] 4.1 删除 `output/production/ai/` 下 `*-v2`、`*-v3` 后缀目录
- [x] 4.2 删除所有 `output/<date>/raw/` 下的 JSON 中间文件（保留目录结构）

## 5. 最终验证与归档

- [x] 5.1 再次 `git status` 确认没有意外文件被删除
- [ ] 5.2 使用子 Agent 进行最终审计复核，对比 spec 逐项确认完成
- [ ] 5.3 更新项目文档（如果架构文档引用了已删除的文件路径）

---

## Post-Implementation Workflow

<!-- DO NOT MODIFY THIS SECTION — it defines the required workflow after all tasks are complete -->

After completing ALL tasks above, follow this sequence strictly:

1. **Verify**: Run `/opsx:verify` to produce verify.md
2. **User Acceptance**: Present change summary, ask user to confirm the problem is solved
3. **Merge**: After user accepts, go to main branch and merge (must ask user)
4. **Archive**: Run `/opsx:archive` on main
5. **Cleanup**: `git worktree remove .worktrees/change/<name>`

**Iteration**: If user does not accept, analyze the issue and recommend:
fix in place / new change / git reset + stash / git reset / abandon.
