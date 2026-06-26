## ADDED Requirements

### Requirement: ClusterEvents SHALL group events by entity overlap

ClusterEvents Task 将具有相似实体的 Event 归为同一 Cluster。聚类条件（满足任一）：实体重叠度 ≥ 0.5、事件指纹相同、标题相似度 ≥ 0.7。

#### Scenario: 实体重叠聚类
- **WHEN** Event A entities = ['OpenAI', 'GPT-6']，Event B entities = ['OpenAI', 'ChatGPT']
- **THEN** 实体重叠度 = 1/3 = 0.33 < 0.5，不聚类

#### Scenario: 实体重叠聚类（高重叠）
- **WHEN** Event A entities = ['OpenAI', 'GPT-6']，Event B entities = ['OpenAI', 'GPT-6', 'API']
- **THEN** 实体重叠度 = 2/3 = 0.67 ≥ 0.5，聚类为同一 Cluster

#### Scenario: 事件指纹聚类
- **WHEN** 两个 Event 的 Entity|EventType|Keywords|Week 指纹相同
- **THEN** 聚类为同一 Cluster

### Requirement: Cluster SHALL have a title derived from highest-scored Event

Cluster 标题 = 该 Cluster 中 rank_total 最高的 Event 的标题。

#### Scenario: Cluster 标题
- **WHEN** Cluster 包含 3 个 Event，最高分 Event 标题为 "OpenAI 发布 GPT-6"
- **THEN** Cluster.title = "OpenAI 发布 GPT-6"

### Requirement: ExtractEntities SHALL match title + summary

实体提取范围从 title 扩展到 title + summary，提高覆盖率。

#### Scenario: summary 中提取实体
- **WHEN** Event title = "New AI Model"，summary = "OpenAI 发布了最新的 GPT-6 模型"
- **THEN** 提取实体 ['OpenAI', 'GPT-6']
