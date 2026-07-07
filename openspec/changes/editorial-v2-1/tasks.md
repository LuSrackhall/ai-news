## 1. 前置修复：Memory API 兼容

- [x] 1.1 在 `memory-store.mjs` 的 `SqliteMemoryStore` 类中新增 `load(since)` 方法，返回 `{ days: {} }` 格式的数据（从 `loadDaySnapshots(since)` 转换）
- [x] 1.2 验证 `EditorialMemoryRule` 在传入 `SqliteMemoryStore` 时不再静默降级（`.load()` 返回有效数据）

## 2. Cross-Day Dedup Rule

- [ ] 2.1 新增 `scripts/domain/editorial/rules/dedup-rule.mjs`，实现 `MemoryDedupRule` 类
- [ ] 2.2 DedupRule 在 evaluate() 中查询 Memory（通过 RuleContext）的 queryStory/getCoverageCount，匹配 cluster_id 或 entity
- [ ] 2.3 匹配到 3 天内已覆盖时产出 FOLLOW_UP signal（RANK phase, weight 从 config 读取，默认 -10）
- [ ] 2.4 匹配到 STALE story 时产出 contextual rejection（可被 BREAKING 覆盖）
- [ ] 2.5 DedupRule 作为 `qualificationRules` 注册到 JudgmentEngine（在 execute-lanes.mjs 中），仅当 memory 可用时注册

## 3. 低密度日 Backfill

- [ ] 3.1 在 `config.mjs` 中新增 `BACKFILL` 配置节：`{ enabled: true, threshold: 20, maxItems: 10, minScore: 40, sources: ['huggingface-blog', 'openai', 'anthropic', 'google-ai-blog', 'deepmind'] }`
- [ ] 3.2 在 `judgment-engine.mjs` 的 `qualify()` 方法之后、`prioritize()` 之前新增 backfill 步骤
- [ ] 3.3 backfill 步骤从 events.db 查询符合条件的补入源事件（`source_name IN (...) AND rank_total >= minScore`），按 rank_total 降序，取 maxItems 条
- [ ] 3.4 补入的事件标记 `_backfill: true`，在 Prioritization 中获得极低 finalRank（确保排在所有正常事件之后）
- [ ] 3.5 补入事件不重复：已在 qualifiedEvents 中的 event（按 id）不重复补入

## 4. 配置项

- [ ] 4.1 在 `config.mjs` 中新增 `SIGNAL_WEIGHTS` 配置节：`{ follow_up: -10 }`
- [ ] 4.2 DedupRule 从 config 读取 FOLLOW_UP weight，而非 hardcode

## 5. 测试

- [ ] 5.1 MemoryDedupRule 单元测试（Memory 有/无历史、cluster_id 匹配、entity 降级、STALE 拒绝、BREAKING 覆盖）
- [ ] 5.2 Backfill 单元测试（低于/高于阈值、补入空数据、重复事件去重、score 门槛过滤）
- [ ] 5.3 集成测试（完整链路：Qualification + Dedup + Backfill + Prioritization）
- [ ] 5.4 确认所有现有测试继续通过

## Post-Implementation Workflow

After completing ALL tasks above, follow this sequence strictly:

1. **Verify**: Run `/opsx:verify` to produce verify.md
2. **User Acceptance**: Present change summary, ask user to confirm the problem is solved
3. **Merge**: After user accepts, go to main branch and merge (must ask user)
4. **Archive**: Run `/opsx:archive` on main
5. **Cleanup**: `git worktree remove .worktrees/change/<name>`

**Iteration**: If user does not accept, analyze the issue and recommend:
fix in place / new change / git reset + stash / git reset / abandon.
