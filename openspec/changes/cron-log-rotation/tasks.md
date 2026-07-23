## 1. 实现日志轮转

- [x] 1.1 在 `scripts/run-ingestion.mjs` 的 `updateRunsMd()` 函数开头添加轮转逻辑：
  - 检查 `data/cron.log` 的 `mtime` 日期
  - 如果 mtime < 今天 → 重命名为 `cron.log.YYYY-MM-DD`
  - 创建新的空 `cron.log`
  - 清理超过 7 天的 `cron.log.*` 归档文件

## 2. 验证

- [x] 2.1 确认 `node --check scripts/run-ingestion.mjs` 通过
- [x] 2.2 确认 `data/cron.log` 仍可正常写入和读取

---

## Post-Implementation Workflow

<!-- DO NOT MODIFY THIS SECTION -->

After completing ALL tasks above, follow this sequence strictly:

1. **Verify**: Run myspec-verify skill to produce verify.md
2. **User Acceptance**: Present change summary, ask user to confirm the problem is solved
3. **Merge**: After user accepts, go to main branch and merge (must ask user)
4. **Archive**: Archive the change on main
5. **Cleanup**: Remove worktree and delete branch
