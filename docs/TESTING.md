# AI 日报 — 测试指南（v4.4）

## 自动化测试

```bash
# SQLite + 聚类 + 周报 + 反馈（21 项）
node scripts/test-sqlite.mjs

# RSSHub 连接池（10 项）
node scripts/test-rsshub-pool.mjs
```

### SQLite 测试覆盖（21 项）

- 数据库创建 + 6 张表存在
- events 表 CRUD（store / storeBatch / dedup / findByWindow / findByEntity / findByTopic）
- event_entities / event_topics 关系表写入
- event_clusters 表（ClusterRepository.store / ClusterReadModel.findAll / findByEntity / findByDateRange）
- events.cluster_id 关联 + findByCluster 查询
- feedback 表写入
- weekly_reports 表写入

### RsshubPool 测试覆盖（10 项）

- 正常返回实例 + 轮询
- 空列表返回 null
- 连续失败 3 次触发熔断
- 熔断后其他实例仍可用
- 全部熔断返回 null
- 成功重置失败计数
- 健康文件持久化
- 跨进程状态恢复
- 实例隔离（reportFailure 只影响指定实例）

## 人工审核检查点

日报生成后检查 `output/<date>/`：

| 检查项 | 期望值 |
|--------|--------|
| curated.json 存在 | 非空 |
| selected_items 数量 | 8-15 条 |
| 至少 1 条 deep | importance = 'deep' |
| 来源多样性 | >= 3 个不同来源 |
| article.md 字数 | > 2000 字 |
| script.md 存在 | 非空 |
| URL 非编造 | 每条 URL 来自 SQLite 查询结果 |

## 端到端验证

```bash
# 1. 采集
node scripts/run-ingestion.mjs

# 2. 检查 SQLite 有数据
sqlite3 data/events.db "SELECT COUNT(*) FROM events"

# 3. 生成日报（/daily）

# 4. 检查产出
cat output/<date>/article.md
cat output/<date>/script.md
```
