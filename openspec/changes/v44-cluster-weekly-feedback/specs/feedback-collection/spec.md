## ADDED Requirements

### Requirement: Feedback collection SHALL store raw feedback data

feedback 表存储原始反馈数据，不做任何学习或权重调整。

#### Scenario: 记录点击
- **WHEN** 用户点击日报中的某条新闻
- **THEN** 写入 feedback 表：type='click', event_id, value=1

#### Scenario: 记录阅读时长
- **WHEN** 用户阅读某条新闻 30 秒
- **THEN** 写入 feedback 表：type='read_time', event_id, value=30
