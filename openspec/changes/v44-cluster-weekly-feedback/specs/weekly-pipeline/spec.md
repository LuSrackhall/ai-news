## ADDED Requirements

### Requirement: Weekly Pipeline SHALL aggregate events by cluster

Weekly Pipeline 读取最近 7 天的 Event，按 Cluster 聚合，生成周报。

#### Scenario: 正常执行
- **WHEN** 执行 `node scripts/run-weekly.mjs`
- **THEN** 读取最近 7 天 Event，按 cluster_id 聚合，生成周报 article.md + script.md

#### Scenario: 无聚类 Event
- **WHEN** 最近 7 天无 cluster_id 的 Event
- **THEN** 按时间窗口直接聚合，不依赖聚类

### Requirement: Weekly output SHALL write to output/weekly/<week>/

#### Scenario: 周报产出
- **WHEN** Weekly Pipeline 完成
- **THEN** output/weekly/<week>/ 目录包含 article.md、script.md、manifest.json
