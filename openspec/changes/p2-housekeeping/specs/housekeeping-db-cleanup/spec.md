## ADDED Requirements

### Requirement: 删除废弃 SQLite 文件

删除 `data/ai-ribao.db` 和 `data/ai-news.db`。

#### Scenario: 文件被删除
- **WHEN** 执行 `ls data/ai-ribao.db data/ai-news.db`
- **THEN** 返回文件不存在
