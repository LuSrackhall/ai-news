## Context

AI 日报项目（Ai-ribao）通过 RSS 采集 → SQLite → Agent 编辑 → 代码渲染的 pipeline 自动生成每日 AI 新闻日报。

当前日报格式为：今日速览 → 重磅深度 → 重要动态 → 快讯 → 编辑观点（4段）。近期新增了 49 个 RSS/Atom 源（含 Wired AI、Axios、Semafor、GitHub Trending、5 个模型厂商 GitHub org、Apple ML、AWS ML、Databricks、35 个厂商 GitHub org 等），总源数从 32 增至 89。

GitHub Atom 源会带来大量 commit 噪音（issues、PR、CI、文档更新等），需要在 ingestion pipeline 中前置过滤，并建立隔离池用于调试。

## Goals / Non-Goals

**Goals:**
- 优化日报章节结构，删除冗余的"今日速览"（用户确认保留）并在"重要动态"中增加类别标签
- 在 ingestion pipeline 中为 GitHub/Atom 源增加噪音过滤规则
- 建立隔离池（quarantine）存储被过滤的事件，保留 3 天供调试
- 为后续批量添加 GitHub 源提供干净的数据管道

**Non-Goals:**
- 不改变 RSS 采集逻辑本身（collect-rss.mjs 不动）
- 不改变评分算法（ranking-policy.mjs 的评分逻辑不动，只新增前置过滤）
- 不实现 HF API 轮询（单独子项目）
- 不改变口播稿的生成逻辑（只调整映射关系）

## Decisions

### 子设计 A：报告格式变更

**A1. 章节结构：保留"今日速览"，重要动态加类别标签**

最终结构：
```
今日速览（全文摘要，一行一条）
🔥 重磅深度（2-3条，四段结构）
📌 重要动态（5-8条，带类别标签）
⚡ 快讯（5-8条，一行一条）
💬 编辑观点（3段：观察/证据/判断）
```

- "今日速览"保留（用户确认），作为全文速读入口
- "重要动态"每条加类别标签，从枚举闭集中选取
- "编辑观点"从 4 段砍到 3 段（"预测"合并进"判断"）
- 不单列"开源与生态"章节——GitHub 通过过滤后的重要项目归入"重要动态[开源项目]"

备选方案：方案 C（6 个主题分类章节）被否决——章节数过多导致读者疲劳，且 Agent 分类决策复杂度高。

**A2. 类别标签枚举**

```
[模型发布] [AI政策] [产品应用] [开源项目] [融资收购] [研究论文] [开发者工具] [AI安全]
```

Agent 必须从枚举中选值，不允许自由生成。

**A3. 口播稿映射**

| 文章章节 | 口播段落 |
|---|---|
| 今日速览 | overview |
| 重磅深度 | deep_items |
| 重要动态 + 快讯 | quick_items |
| 编辑观点 | closing |

**A4. 影响文件**

| 文件 | 改动 |
|---|---|
| `scripts/policies/render-policy.mjs` | 重要动态渲染加标签，编辑观点砍到3段 |
| `prompts/v1/curation.md` | 加类别标签枚举，调数量范围 |
| `prompts/v1/article.md` | 更新文章 JSON 结构 |
| `prompts/v1/script.md` | 更新口播稿 JSON 结构 |
| `scripts/policies/validation-policy.mjs` | 适配新结构 |

### 子设计 B：GitHub 噪音过滤 + 隔离池

**B1. 数据流**

```
RSS/Atom 采集 → 事件标准化 → GitHub 噪音过滤器（新增）
  ├── 通过 → 评分 → 主事件池（SQLite events）
  └── 拦截 → 隔离池（quarantine 表）→ 保留3天 → 自动清理
```

**B2. 噪音过滤规则**

针对 sourceId 包含 `github` 的事件：

| 条件 | 动作 |
|---|---|
| URL 含 `/issues/` `/pull/` `/commit/` `/actions/` | 丢弃 |
| 标题匹配 `/^(fix\|chore\|ci\|docs\|build\|test\|refactor):/` | 丢弃 |
| 标题匹配 `/^(feat\|release\|breaking):/` 或含版本号 `v\d+\.\d+` | 保留 |
| 新 repo 创建（标题为 `org/repo` 格式） | 保留 |

可配置参数（config.mjs）：
```js
export const GITHUB_NOISE_RULES = {
  enabled: true,
  quarantineDays: 3,
  dropPatterns: [/^\/(issues|pull|commit|actions)\//],
  dropTitlePatterns: [/^(fix|chore|ci|docs|build|test|refactor)(\(|:)/],
  keepTitlePatterns: [/^(feat|release|breaking)(\(|:)/, /v\d+\.\d+/],
}
```

**B3. 隔离池存储**

SQLite 新增 `quarantine` 表：
```sql
CREATE TABLE IF NOT EXISTS quarantine (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  source_id TEXT,
  title TEXT,
  url TEXT,
  reason TEXT,
  quarantined_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
```

- 3 天后自动清理（ingestion 启动时执行 `DELETE FROM quarantine WHERE expires_at < now`）
- 可查询调试：`SELECT * FROM quarantine WHERE source_id = 'deepseek-github'`

**B4. 影响文件**

| 文件 | 改动 |
|---|---|
| `scripts/config.mjs` | 新增 `GITHUB_NOISE_RULES` 配置块 |
| `scripts/rules/github-noise-rule.mjs` | 新增噪音过滤规则 |
| `scripts/infrastructure/database.mjs` | 新增 quarantine 表 |
| `scripts/tasks-ingestion/` | normalize 后插入过滤步骤 |

## Risks / Trade-offs

- **误杀风险**：正则过滤可能误杀有价值的 commit（如 `docs: release v4.0 announcement`）。→ 隔离池保留 3 天，可手动恢复。
- **GitHub 源噪音量大**：54 个源中约 20 个是 GitHub Atom，每次采集可能产生数百条噪音事件。→ 正则前置过滤计算成本极低，不影响 pipeline 性能。
- **标签枚举覆盖不全**：8 个类别标签无法覆盖所有场景（如"AI伦理"、"数据隐私"）。→ 预留 `general` 作为兜底，Agent 可在无匹配时使用。
- **编辑观点从 4 段砍到 3 段**：可能丢失前瞻性内容。→ "判断"段的最后一句承担预测功能，保持信息密度。
