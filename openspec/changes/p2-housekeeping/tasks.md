## 1. 删除废弃 SQLite

- [x] 1.1 删除 `data/ai-ribao.db` 和 `data/ai-news.db`（0 字节文件）

## 2. 移动测试文件

- [x] 2.1 创建 `scripts/tests/` 目录
- [x] 2.2 将 `scripts/domain/editorial/test-*.mjs`（11 个）移至 `scripts/tests/`
- [x] 2.3 确认 `scripts/domain/editorial/` 下无 test- 文件残留

## 3. 验证

- [x] 3.1 确认两个 db 文件已删除
- [x] 3.2 确认 11 个测试文件在 `scripts/tests/` 下
- [x] 3.3 `git status` 确认无意外修改

---

## Post-Implementation Workflow

<!-- DO NOT MODIFY THIS SECTION -->

After completing ALL tasks above, follow this sequence strictly:

1. **Verify**: Run myspec-verify skill to produce verify.md
2. **User Acceptance**: Present change summary, ask user to confirm the problem is solved
3. **Merge**: After user accepts, go to main branch and merge (must ask user)
4. **Archive**: Archive the change on main
5. **Cleanup**: Remove worktree and delete branch
