## Why

当前系统在 Ingestion 的 Event Ranking（Score）与 Editorial 的 LLM Curation 之间缺少编辑智能层。所有 Event 直接喂给 LLM 做选题——LLM 同时承担"编辑判断"和"内容生成"两项职责。当 Event 规模从当前的 50-80 条增长到 200-500 条时，这会系统性地导致：Breaking News 漏报（重要但聚类小的新闻被淹没）、主题失衡（日报被单一公司和模型占满）、跨天重复（LLM 不知道昨天报道了什么）。

## What Changes

- 新增 **Candidate Builder** 领域服务，在 Editorial Pipeline 的"读 SQLite"与"LLM 选题"之间插入编辑智能层
- 定义统一的 **EditorialSignal** 模型（phase + subtype + weight），Rule 产出信号而非修改 Event
- 建立三阶段 **Signal Lifecycle**：FILTER（硬约束）→ RANK（软排序）→ ANNOTATION（LLM 上下文）
- 实现三项确定性 Editorial Rule：
  - **BreakingRule**：高价值实体/来源的保底机制，即使聚类小也进入候选池
  - **DiversityRule**：确保候选池覆盖 ≥ 5 个主题类别，单类别上限 8 条
  - **EditorialMemoryRule**：基于过去 7 天报道历史标注跨天重复事件
- 新增 `BuildCandidates` Task，插入 Editorial Pipeline 的 `SelectEditorialWindow` 之后
- LLM 选题（`CurateEvents`）的输入从 `ctx._events` 切换为 `ctx._candidates`（**BREAKING**：修改 CurateEvents Task 的消费来源）

## Capabilities

### New Capabilities
- `candidate-builder`: Candidate Builder 领域服务核心——Rule Pipeline 执行引擎、Signal 收集与 Lifecycle 解析、Candidate Pool 构建
- `editorial-signal`: EditorialSignal 模型及其三阶段 Lifecycle（FILTER/RANK/ANNOTATION）和 Resolution Policy
- `breaking-rule`: BreakingRule——基于实体优先级、来源权重、事件类型的确定性保底机制
- `diversity-rule`: DiversityRule——Category 覆盖率约束和单类别上限控制
- `editorial-memory-rule`: EditorialMemoryRule + EditorialMemoryStore 接口——跨天报道记忆的存储与查询

### Modified Capabilities
- `editorial-pipeline`: Editorial Pipeline 新增 `BuildCandidates` step，`CurateEvents` Task 消费来源从 `ctx._events` 改为 `ctx._candidates`

## Impact

- 新增 `scripts/domain/editorial/` 目录（CandidateBuilder、Rule 实现、Signal 模型）
- 新增 `data/editorial-memory.json`（跨天记忆存储）
- 修改 `scripts/pipelines/editorial.mjs`（插入 BuildCandidates step）
- 修改 `scripts/tasks-editorial/curate-events.mjs`（消费 ctx._candidates）
- 新增 `scripts/tasks-editorial/build-candidates.mjs`
- 新增 `scripts/services/editorial-memory-store.mjs`（JsonEditorialMemoryStore）
- LLM Curation prompt（`prompts/v1/curation.md`）需适配 Candidate Pool 格式（新增 contextHints 字段）
