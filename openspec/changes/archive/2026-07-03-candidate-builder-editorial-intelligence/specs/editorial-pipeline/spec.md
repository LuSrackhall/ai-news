## MODIFIED Requirements

### Requirement: Editorial Pipeline Steps

Editorial Pipeline SHALL 在 SelectEditorialWindow 之后、CurateEvents 之前插入 BuildCandidates step。

Pipeline step 顺序 MUST 为：
1. SelectEditorialWindow
2. BuildCandidates
3. CurateEvents
4. GenerateArticle
5. GenerateScript
6. RenderArtifacts
7. ValidateOutput
8. ArchiveOutput

#### Scenario: BuildCandidates insertion point
- **WHEN** Editorial Pipeline 执行
- **THEN** BuildCandidates MUST 在 SelectEditorialWindow 完成后执行
- **AND** CurateEvents MUST 在 BuildCandidates 完成后执行

### Requirement: CurateEvents Consumes Candidates

CurateEvents Task SHALL 从 `ctx._candidates` 读取输入，而非 `ctx._events`。Candidate 列表 SHALL 包含 contextHints 字段供 LLM prompt 使用。

#### Scenario: CurateEvents input source
- **WHEN** CurateEvents Task execute() 被调用
- **THEN** 输入数据 MUST 来自 ctx._candidates
- **AND** SHALL NOT 直接使用 ctx._events

#### Scenario: Fallback when ctx._candidates is empty
- **WHEN** ctx._candidates 为空或未定义
- **THEN** CurateEvents SHALL 回退到从 ctx._events 构建默认候选列表
- **AND** SHALL 记录 warning log
