# Ingestion Runtime — 运维文档

## 运行方式

```bash
# 手动运行（今天）
node scripts/run-ingestion.mjs

# 指定日期
node scripts/run-ingestion.mjs --date 2026-06-24

# 定时运行（每 5 分钟）
# crontab -e
# */5 * * * * cd /path/to/ai-ribao && node scripts/run-ingestion.mjs
```

## 前置条件

- `ANTHROPIC_API_KEY` 环境变量（Ingestion 不用 LLM，但 Host 初始化需要）
- `npm install`（better-sqlite3 依赖）
- `scripts/collect-rss.mjs` 和 `scripts/verify-urls.mjs` 可用

## 数据流

```
RSS feeds → Asset[] → Normalize → Verify → Extract Entities → Score → Dedup → SQLite
```

## SQLite 数据库

位置：`data/events.db`

### 查看数据

```bash
sqlite3 data/events.db "SELECT COUNT(*) FROM events"
sqlite3 data/events.db "SELECT id, title, rank_total FROM events ORDER BY rank_total DESC LIMIT 10"
sqlite3 data/events.db "SELECT entity, COUNT(*) FROM event_entities GROUP BY entity ORDER BY COUNT(*) DESC LIMIT 10"
```

### 时间查询

```sql
-- 按 effective_at 查询
SELECT * FROM events WHERE effective_at >= '2026-06-24T08:00:00' AND effective_at < '2026-06-25T08:00:00'

-- 按实体查询
SELECT e.* FROM events e JOIN event_entities ee ON e.id = ee.id WHERE ee.entity = 'OpenAI'
```

## 增量处理

Ingestion 使用 `INSERT OR IGNORE` + `content_hash UNIQUE` 实现增量：
- 新 Event → 插入
- 重复 Event → 跳过（不报错）
- 同一条 RSS 在多次运行中被采集 → 只入库一次

## 故障排查

| 问题 | 排查 |
|------|------|
| 0 条入库 | 检查 RSS 源可达性，检查时间窗口 |
| 重复入库 | 不应该发生（UNIQUE 约束），检查 content_hash 计算 |
| SQLite 锁 | WAL mode 已启用，检查是否有其他进程占用 |
