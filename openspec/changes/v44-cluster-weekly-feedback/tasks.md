## 1. SQLite Schema 扩展

- [x] 1.1 修改 `scripts/infrastructure/database.mjs`：新增 event_clusters、weekly_reports、feedback 三张表 + 索引

## 2. 实体提取增强

- [x] 2.1 修改 `scripts/tasks-ingestion/extract-entities.mjs`：匹配范围扩展到 title + summary（已实现）
- [x] 2.2 在 `scripts/config.mjs` 中增加中文实体词典（36kr、百度、阿里、腾讯、字节等）

## 3. 事件聚类

- [x] 3.1 创建 `scripts/domain/cluster.mjs`：ClusterPolicy（实体重叠度 + 事件指纹 + 标题相似度三重匹配）
- [x] 3.2 创建 `scripts/tasks-ingestion/cluster-events.mjs`：ClusterEvents Task（调 ClusterPolicy，写入 event_clusters + 更新 events.cluster_id）
- [x] 3.3 修改 `scripts/pipelines/ingestion.mjs`：在 ExtractEntities 后插入 ClusterEvents

## 4. ReadModel 扩展

- [x] 4.1 修改 `scripts/read-models/sqlite/event-read-model.mjs`：新增 findByCluster(clusterId) 方法
- [x] 4.2 创建 `scripts/read-models/sqlite/cluster-read-model.mjs`：ClusterReadModel（findAll/findByEntity/findByDateRange）
- [x] 4.3 创建 `scripts/repositories/sqlite/cluster-repository.mjs`：ClusterRepository（store/update）

## 5. Weekly Pipeline

- [x] 5.1 创建 `scripts/tasks-weekly/load-week-events.mjs`：LoadWeekEvents Task（读取最近 7 天 Event）
- [x] 5.2 创建 `scripts/tasks-weekly/aggregate-by-cluster.mjs`：AggregateByCluster Task（按 cluster_id 聚合）
- [x] 5.3 创建 `scripts/tasks-weekly/generate-weekly-article.mjs`：GenerateWeeklyArticle Task（LLM 生成周报文章）
- [x] 5.4 创建 `scripts/tasks-weekly/render-weekly.mjs`：RenderWeekly Task（渲染周报 Markdown）
- [x] 5.5 创建 `scripts/tasks-weekly/archive-weekly.mjs`：ArchiveWeekly Task（写 output/weekly/<week>/）
- [x] 5.6 创建 `scripts/pipelines/weekly.mjs`：WeeklyPipeline 声明（5 个 steps）
- [x] 5.7 创建 `scripts/run-weekly.mjs`：入口脚本（纯 Node.js）

## 6. 反馈收集

- [x] 6.1 创建 `scripts/repositories/sqlite/feedback-repository.mjs`：FeedbackRepository（store）

## 7. Scope 改造

- [x] 7.1 修改 `scripts/infrastructure/scope.mjs`：buildScope 注入 clusterRepository + clusterReadModel + feedbackRepository

## 8. Skill 更新

- [x] 8.1 修改 `.claude/skills/ai-daily/SKILL.md`：新增 Weekly Pipeline 说明

## 9. 测试 + 文档

- [x] 9.1 修改 `scripts/test-sqlite.mjs`：新增 event_clusters/weekly_reports/feedback 表测试（21 tests pass）
- [x] 9.2 创建 `docs/versions/v4.4.md`：v4.4 版本文档
- [x] 9.3 创建 `docs/versions/v4.3.md`：v4.3 说明文档（合并入 v4.4）

---

## Post-Implementation Workflow

After completing ALL tasks above, follow this sequence strictly:

1. **Verify**: Run `/opsx:verify` to produce verify.md
2. **User Acceptance**: Present change summary, ask user to confirm
3. **Merge**: After user accepts, merge to main
4. **Archive**: Run `/opsx:archive` on main
5. **Cleanup**: Remove worktree
