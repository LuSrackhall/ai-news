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

### 设置定时采集（cron）

cron 是系统自带的定时任务调度器（macOS/Linux），不是项目功能。项目只提供脚本，什么时候跑由 cron 决定。

```bash
# 1. 编辑定时任务
crontab -e

# 2. 添加以下行（每 6 小时采集一次，日志写入 data/cron.log）
0 */6 * * * cd /Users/srackhalllu/safe-project/Ai-ribao && node scripts/run-ingestion.mjs >> data/cron.log 2>&1

# 3. 保存退出，验证是否生效
crontab -l
```

**常用调度频率：**

| cron 表达式 | 含义 |
|-------------|------|
| `0 */6 * * *` | 每 6 小时（推荐） |
| `0 */4 * * *` | 每 4 小时 |
| `0 8,14,20 * * *` | 每天 8:00、14:00、20:00 |
| `0 */12 * * *` | 每 12 小时 |

**注意：** cron 运行时没有交互式终端，日志输出到 `data/cron.log`。排查问题时查看此文件。

### 观测 RSS 源健康状态

采集完成后，查看各源的成败：

```bash
# 各源健康状态（🟢正常 🟡警告 🔴失败）
cat data/source-health.json | node -e "
const h = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))
for (const [id, s] of Object.entries(h)) {
  const icon = s.failStreak >= 3 ? '🔴' : s.failStreak >= 1 ? '🟡' : '🟢'
  console.log(icon, id, '| 连败:', s.failStreak, '| 最后成功:', s.lastSuccess?.slice(0,16) || 'never')
}
"

# RSSHub 实例熔断状态
cat data/rsshub-health.json | node -e "
const h = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))
for (const [url, s] of Object.entries(h)) {
  const icon = s.status === 'open' ? '🔴熔断' : s.status === 'half-open' ? '🟡试探' : '🟢正常'
  console.log(icon, url, '| 连败:', s.consecutiveFailures)
}
"
```

每次采集结束也会输出汇总日志：

```
📊 汇总:
   成功源: 28/33 (禁用: 2)
   原始条目: 156 → 去重后: 89
   失败源: anthropic-news, deepseek-news
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

## 运行监控

### 查看采集日志

```bash
# 最近一次采集日志
tail -30 data/cron.log

# 搜索某天的日志
grep "2026-06-27" data/cron.log

# 只看失败的源
grep "❌" data/cron.log

# 只看采集汇总
grep "📊" data/cron.log
```

### 查看数据库数据

```bash
# 总事件数
sqlite3 data/events.db "SELECT COUNT(*) FROM events"

# 最近 7 天每天的事件数
sqlite3 data/events.db "SELECT date(effective_at) as 日期, COUNT(*) as 条数 FROM events GROUP BY date(effective_at) ORDER BY 日期 DESC LIMIT 7"

# 聚类数
sqlite3 data/events.db "SELECT COUNT(*) FROM event_clusters"

# 最高分事件
sqlite3 data/events.db "SELECT title, rank_total FROM events ORDER BY rank_total DESC LIMIT 10"
```

### RSS 源健康状态

```bash
# 各源成败（🟢正常 🟡警告 🔴失败）
cat data/source-health.json | node -e "
const h = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))
for (const [id, s] of Object.entries(h)) {
  const icon = s.failStreak >= 3 ? '🔴' : s.failStreak >= 1 ? '🟡' : '🟢'
  console.log(icon, id, '| 连败:', s.failStreak, '| 最后成功:', s.lastSuccess?.slice(0,16) || 'never')
}
"

# RSSHub 实例熔断状态
cat data/rsshub-health.json | node -e "
const h = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))
for (const [url, s] of Object.entries(h)) {
  const icon = s.status === 'open' ? '🔴熔断' : s.status === 'half-open' ? '🟡试探' : '🟢正常'
  console.log(icon, url, '| 连败:', s.consecutiveFailures)
}
"
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
