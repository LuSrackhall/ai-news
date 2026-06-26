## 1. RsshubPool 核心模块

- [ ] 1.1 创建 `scripts/infrastructure/rsshub-pool.mjs`：RsshubPool 类（constructor + getInstance + reportSuccess + reportFailure）
- [ ] 1.2 实现熔断器三态逻辑（CLOSED → OPEN → HALF-OPEN，指数退避 10min × 2^n，上限 2h）
- [ ] 1.3 实现健康持久化：启动时读取 data/rsshub-health.json，请求结束后写入

## 2. 配置

- [ ] 2.1 在 `scripts/config.mjs` 中新增 `RSSHUB_INSTANCES` 数组（5 个公共实例 URL）
- [ ] 2.2 在 `scripts/config.mjs` 的 `RSS_SOURCES` 中新增 RSSHub 中转源条目（Anthropic、DeepSeek、机器之心等，用 `rsshub` 字段标记路由路径）

## 3. collect-rss.mjs 集成

- [ ] 3.1 导入 RsshubPool，在 fetchFeed 中对 rsshub 源走连接池拼接 URL（~8 行改动）
- [ ] 3.2 在 fetchFeed 成功/失败回调中调用 pool.reportSuccess / reportFailure
- [ ] 3.3 RSSHub 源采集间隔从 200ms 调整为 1500ms
- [ ] 3.4 区分网络失败（计入熔断）vs 内容失败（不计入熔断）

## 4. 测试

- [ ] 4.1 创建 `scripts/test-rsshub-pool.mjs`：单元测试（mock fetch，覆盖熔断/恢复/全部熔断/持久化场景）

---

## Post-Implementation Workflow

After completing ALL tasks above, follow this sequence strictly:

1. **Verify**: Run `/opsx:verify` to produce verify.md
2. **User Acceptance**: Present change summary, ask user to confirm the problem is solved
3. **Merge**: After user accepts, go to main branch and merge (must ask user)
4. **Archive**: Run `/opsx:archive` on main
5. **Cleanup**: `git worktree remove .worktrees/change/<name>`
