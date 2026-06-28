## Why

AI 日报项目近期新增了 49 个 RSS/Atom 源（含 GitHub Trending、40 个厂商 GitHub org、Wired AI、Axios、Semafor、Apple ML、AWS ML、Databricks 等），总源数从 32 增至 89。GitHub Atom 源会带来大量 commit/issue/PR 噪音，需要在 ingestion pipeline 中前置过滤。同时日报章节结构需要优化——增加类别标签、精简编辑观点段落，以提升扫读体验和 Agent 选题效率。

## What Changes

**子设计 A：报告格式变更**
- 在"重要动态"章节中增加类别标签（枚举闭集：模型发布/AI政策/产品应用/开源项目/融资收购/研究论文/开发者工具/AI安全）
- "编辑观点"从 4 段砍到 3 段（"预测"合并进"判断"）
- 更新 curation.md prompt 适配新结构
- 更新 render-policy.mjs 渲染逻辑
- 更新 validation-policy.mjs 一致性检查

**子设计 B：GitHub 噪音过滤 + 隔离池**
- 新增 `github-noise-rule.mjs`：正则过滤 GitHub 源的 commit/issue/PR 噪音
- 新增 SQLite `quarantine` 表：存储被过滤事件，保留 3 天供调试
- 在 `config.mjs` 中新增 `GITHUB_NOISE_RULES` 可配置参数
- 在 ingestion pipeline 中 normalize 后插入过滤步骤

## Capabilities

### New Capabilities
- `report-format`: 日报章节结构优化（类别标签、编辑观点精简、curation prompt 更新）
- `github-noise-filter`: GitHub/Atom 源噪音过滤规则和隔离池

### Modified Capabilities

## Impact

- `scripts/policies/render-policy.mjs` — 渲染逻辑调整
- `scripts/policies/validation-policy.mjs` — 一致性检查适配
- `scripts/config.mjs` — 新增噪音过滤配置
- `scripts/rules/github-noise-rule.mjs` — 新增规则文件
- `scripts/infrastructure/database.mjs` — 新增 quarantine 表
- `scripts/tasks-ingestion/` — 插入过滤步骤
- `prompts/v1/curation.md` — 选题 prompt 更新
- `prompts/v1/article.md` — 文章 prompt 更新
- `prompts/v1/script.md` — 口播稿 prompt 更新
