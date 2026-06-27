# AI 日报 操作手册（v4.4 Dual Runtime）

## 日常操作

### 采集新闻

```bash
# 手动运行
node scripts/run-ingestion.mjs

# 指定日期
node scripts/run-ingestion.mjs --date 2026-06-26

# 定时运行（cron）
# 0 */6 * * * cd /path/to/ai-ribao && node scripts/run-ingestion.mjs
```

### 生成日报

```
/daily
```

Agent 自动执行 7 步：读取 SQLite → 选题 → 写文章 → 写口播稿 → 渲染 → 校验 → 归档。

### 生成周报

```bash
node scripts/run-weekly.mjs
node scripts/run-weekly.mjs --week 2026-06-26
```

### 检查产出

```bash
# 日报产出
ls output/2026-06-26/
# article.md    — 日报文章
# script.md     — 口播稿
# curated.json  — 选题结果

# 周报产出
ls output/weekly/2026-06-20_2026-06-26/
# article.md    — 周报文章
# script.md     — 播客脚本
# manifest.json — 元数据
```

## 信源管理

### 添加直接 RSS 源

编辑 `scripts/config.mjs` 的 `RSS_SOURCES`，照格式加一条：

```js
{ id: 'my-source', name: 'My Source', url: 'https://example.com/feed', tier: 2, language: 'en', category: 'media' },
```

### 添加 RSSHub 中转源

```js
{ id: 'my-source', name: 'My Source', rsshub: '/my-source/news', tier: 2, language: 'zh', category: 'media' },
```

`rsshub` 字段写路由路径，不含实例域名。路由查阅 https://docs.rsshub.app/

### 添加 RSSHub 实例

编辑 `scripts/config.mjs` 的 `RSSHUB_INSTANCES` 数组，加一行 URL 即可：

```js
'https://my-rsshub-instance.com',
```

### RSSHub 健康状态

RSSHub 实例的熔断状态保存在 `data/rsshub-health.json`。30 分钟自动恢复。

## 评分调整

编辑 `scripts/config.mjs` 的 `SCORING` / `ENTITY_WEIGHTS` / `EVENT_TYPE_WEIGHTS`。

## 数据库

```bash
# 数据库位置
data/events.db

# 查看事件数
sqlite3 data/events.db "SELECT COUNT(*) FROM events"

# 查看聚类数
sqlite3 data/events.db "SELECT COUNT(*) FROM event_clusters"
```

## 故障排查

| 问题 | 排查方式 |
|------|---------|
| 采集条目为空 | 检查 `data/source-health.json` 的 failStreak |
| RSSHub 源全部失败 | 检查 `data/rsshub-health.json` 的实例状态 |
| SQLite 为空 | 先运行 `node scripts/run-ingestion.mjs` |
| 日报质量差 | 检查 `output/<date>/curated.json` 的选题 |
| 周报为空 | 确认最近 7 天有入库事件 |

## 测试

```bash
node scripts/test-sqlite.mjs        # 21 项
node scripts/test-rsshub-pool.mjs   # 10 项
```
