## 1. 子设计 A：报告格式变更

- [x] 1.1 更新 `prompts/v1/curation.md`：增加类别标签枚举（8个标签），调整重要动态数量范围为 5-8 条，快讯数量范围为 5-8 条，总条目范围 15-20 条
- [x] 1.2 更新 `scripts/policies/render-policy.mjs`：重要动态渲染时在标题前加 `**[category]**` 标签，编辑观点从 4 段改为 3 段（移除 prediction 字段渲染）
- [x] 1.3 更新 `scripts/policies/validation-policy.mjs`：一致性检查适配新结构，移除 editorial prediction 检查
- [x] 1.4 更新 `prompts/v1/article.md`：更新文章 JSON 结构说明，important_items 增加 category 字段，editorial 移除 prediction 字段
- [x] 1.5 更新 `prompts/v1/script.md`：更新口播稿 JSON 结构说明，closing 承担原 prediction 功能

## 2. 子设计 B：GitHub 噪音过滤 + 隔离池

- [x] 2.1 在 `scripts/config.mjs` 中新增 `GITHUB_NOISE_RULES` 配置块（enabled、quarantineDays、dropPatterns、keepTitlePatterns）
- [x] 2.2 新建 `scripts/rules/github-noise-rule.mjs`：实现正则过滤逻辑（URL 路径匹配 + 标题匹配）
- [x] 2.3 更新 `scripts/infrastructure/database.mjs`：新增 quarantine 表（id、event_id、source_id、title、url、reason、quarantined_at、expires_at）
- [x] 2.4 在 ingestion pipeline 中插入噪音过滤步骤：在 normalize-assets 之后、score-events 之前调用 github-noise-rule
- [x] 2.5 实现隔离池自动清理：ingestion 启动时执行 `DELETE FROM quarantine WHERE expires_at < now`

## 3. 测试与验证

- [x] 3.1 用 6 月 28 日数据跑完整 pipeline，验证新格式渲染正确
- [x] 3.2 验证 GitHub 噪音过滤：检查 quarantine 表中是否有被正确拦截的事件
- [x] 3.3 验证类别标签：检查 article.md 中重要动态条目是否带标签

---

## Post-Implementation Workflow

After completing ALL tasks above, follow this sequence strictly:

1. **Verify**: Run `/opsx:verify` to produce verify.md
2. **User Acceptance**: Present results to user for approval
3. **Merge**: Run myspec-merge to integrate changes
