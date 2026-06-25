---
name: ai-daily
description: AI 领域日报自媒体自动化。用户说"生成今日日报"或"/daily"时触发。v4.2 Dual Runtime：Ingestion（持续采集）+ Editorial（定时生产）。Skill 是薄入口，业务逻辑在 scripts/。
---

# AI 日报

从 15+ 信源采集 AI 新闻，经评分、去重、选题后，生成日报文章和视频口播稿。

## 触发条件

- "生成今日日报" → 运行 Editorial Runtime
- "采集今日 AI 新闻" → 运行 Ingestion Runtime
- "/daily" → Editorial Runtime 别名

## 设计原则

> **Skill 是薄入口，Runtime 是厚核心。**

Skill 只做三件事：
1. 读取配置
2. 运行入口脚本
3. 检查产出

所有业务逻辑在 `scripts/` 中。

## 架构：Dual Runtime

```
Ingestion Runtime（持续/高频/无 LLM）
  collect → normalize → verify → extract → score → dedup → store
  输出 → SQLite Event Repository
                                    ↓
Editorial Runtime（定时/低频/LLM 密集）
  selectWindow → curate → generate → render → validate → archive
  输入 ← SQLite Event Repository
  输出 → output/<date>/
```

### 入口命令

```bash
# 采集（每 5-30 分钟运行一次，或手动）
node scripts/run-ingestion.mjs
node scripts/run-ingestion.mjs --date 2026-06-24

# 日报（每天 08:00 或手动）
node scripts/run-editorial.mjs
node scripts/run-editorial.mjs --date 2026-06-24
```

### 核心文件

| 文件 | 职责 |
|------|------|
| `scripts/run-ingestion.mjs` | Ingestion 入口（纯 Node.js） |
| `scripts/run-editorial.mjs` | Editorial 入口（纯 Node.js） |
| `scripts/infrastructure/database.mjs` | SQLite 初始化 |
| `scripts/repositories/sqlite/` | Event 写模型（INSERT OR IGNORE） |
| `scripts/read-models/sqlite/` | Event 读模型（findByWindow/findByEntity） |
| `scripts/policies/*.mjs` | Policy（ranking/dedup/render/validate） |
| `scripts/rules/*.mjs` | Rule（纯函数） |
| `scripts/config.mjs` | 信源/评分/权重配置 |

## Ingestion Runtime

```
CollectAssets → NormalizeAssets → VerifyAssets → ExtractEntities → ScoreEvents → DedupEvents → StoreEvents
```

- 7 个 Task，全部确定性（无 LLM）
- 增量处理：content_hash UNIQUE + INSERT OR IGNORE
- 时间语义：effective_at + time_precision

详见 `references/INGESTION.md`。

## Editorial Runtime

```
SelectEditorialWindow → CurateEvents → GenerateArticle → GenerateScript → RenderArtifacts → ValidateOutput → ArchiveOutput
```

- 7 个 Task，3 个 LLM（Curate + Generate×2）
- 按 effective_at 时间窗口查询 Event
- 输出到 `output/<date>/`

## 硬性检查点

### Checkpoint 1: Ingestion 完成后
- [ ] stored > 0（有新 Event 入库）
- [ ] sources_ok >= 10

### Checkpoint 2: 选题完成后
- [ ] selected 在 8-15 之间
- [ ] 至少 1 条 deep 级别

### Checkpoint 3: 校验完成后
- [ ] validation_passed = true
- [ ] article_chars > 2000
- [ ] script 总时长 180-300s

## 参考文档

| 文档 | 用途 |
|------|------|
| `references/EDITORIAL.md` | 内容标准和写作风格 |
| `references/QUALITY.md` | 质量标准和反模式 |
| `references/INGESTION.md` | Ingestion 运维文档 |

## 信源管理

编辑 `scripts/config.mjs` 的 `RSS_SOURCES`。

## 评分体系

详见 `scripts/config.mjs` 的 `SCORING` / `ENTITY_WEIGHTS` / `EVENT_TYPE_WEIGHTS`。

## 扩展指南

### 新增信源
编辑 `scripts/config.mjs` 的 `RSS_SOURCES`。

### 调整评分
编辑 `scripts/config.mjs` 的 `SCORING` / `ENTITY_WEIGHTS`。

### 新增 Pipeline
创建 `scripts/pipelines/weekly.mjs`，定义 `steps` 数组。
