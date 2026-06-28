## Context

AI 日报项目通过 RSS 采集 → SQLite → Agent 编辑 → 代码渲染的 pipeline 自动生成日报。当前 54 个 RSS/Atom 源，其中约 20 个是 GitHub Atom 源。现有日报格式为：今日速览 → 重磅深度 → 重要动态 → 快讯 → 编辑观点（4段）。

## Goals / Non-Goals

**Goals:**
- 在"重要动态"中增加类别标签（枚举闭集）
- "编辑观点"从 4 段精简为 3 段
- 为 GitHub/Atom 源增加噪音过滤规则
- 建立隔离池存储被过滤事件（保留 3 天）

**Non-Goals:**
- 不改变 RSS 采集逻辑（collect-rss.mjs 不动）
- 不改变评分算法核心逻辑
- 不实现 HF API 轮询
- 不改变口播稿生成逻辑（只调整映射）

## Decisions

### D1：类别标签枚举闭集

标签列表：`[模型发布] [AI政策] [产品应用] [开源项目] [融资收购] [研究论文] [开发者工具] [AI安全]`

Agent 从枚举中选值，不允许自由生成。渲染时以粗体方括号显示在标题前。

### D2：编辑观点精简

从 4 段（观察/证据/判断/预测）改为 3 段（观察/证据/判断）。"预测"的最后一句合并进"判断"段。

### D3：GitHub 噪音过滤规则

正则匹配 URL 路径和 commit 标题：
- 丢弃：URL 含 `/issues/` `/pull/` `/commit/` `/actions/`
- 丢弃：标题匹配 `/^(fix|chore|ci|docs|build|test|refactor)(\(|:)/`
- 保留：标题匹配 `/^(feat|release|breaking)(\(|:)/` 或含版本号
- 保留：新 repo 创建

### D4：隔离池 SQLite 表

新增 `quarantine` 表，字段：id, event_id, source_id, title, url, reason, quarantined_at, expires_at。3 天后自动清理。

### D5：配置化

`config.mjs` 新增 `GITHUB_NOISE_RULES` 块，支持 `enabled`、`quarantineDays`、`dropPatterns`、`keepTitlePatterns` 等参数。

## Risks / Trade-offs

- **误杀风险**：正则过滤可能误杀有价值的 commit → 隔离池保留 3 天，可手动恢复
- **标签覆盖不全**：8 个标签无法覆盖所有场景 → Agent 可在无匹配时使用 note 字段说明
- **编辑观点精简**：可能丢失前瞻性 → "判断"段末句承担预测功能
