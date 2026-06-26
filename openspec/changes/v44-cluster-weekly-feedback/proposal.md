## Why

v4.2 的 Dual Runtime 已稳定运行，但架构上限不够：实体提取覆盖率仅 7%，无法支撑事件聚类；没有周报能力；没有反馈数据收集。v4.4 的目标是在不改 Runtime 的前提下，通过新增 Task + 新增 Pipeline + 扩展 Schema，把架构提升到最高上限。

## What Changes

- **SQLite Schema 扩展**：新增 event_clusters + weekly_reports + feedback 三张表
- **实体提取增强**：regex 匹配 title + summary + 词典，覆盖率从 7% 提升到 30%+
- **事件聚类**：规则聚类（实体重叠度 ≥ 0.5），N Event → 1 Cluster
- **聚类后 Event 构建**：Cluster 标题 = 最高分 Event 标题，cluster_id 写入 events 表
- **Weekly Pipeline**：读取 7 天 Event，按 Cluster 聚合，生成周报
- **反馈数据收集**：feedback 表 + 写入接口（v4.5 Learning Engine 消费）
- **版本文档**：docs/versions/v4.4.md

## Capabilities

### New Capabilities
- `event-clustering`: 规则聚类引擎（实体重叠度 + 事件指纹 + 标题相似度）
- `weekly-pipeline`: Weekly Pipeline（7 天 Event → 按 Cluster 聚合 → 周报）
- `feedback-collection`: 反馈数据收集（click/read_time/share/rating）

### Modified Capabilities
- `ingestion-runtime`: 新增 ClusterEvents Task，ExtractEntities 增强（summary + 词典）
- `sqlite-repository`: 新增 event_clusters + weekly_reports + feedback 表

## Impact

- **受影响代码**：scripts/tasks-ingestion/（新增 ClusterEvents + 增强 ExtractEntities）、scripts/infrastructure/database.mjs（新增表）、scripts/pipelines/（新增 weekly.mjs）、.claude/skills/ai-daily/SKILL.md（新增周报流程）
- **Runtime 不变**：Host/Task/PolicyEngine/Repository 框架不变
- **v4.2 数据兼容**：新增表不影响现有 events 表，INSERT OR IGNORE 保证兼容
