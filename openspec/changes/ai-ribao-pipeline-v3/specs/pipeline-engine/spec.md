## ADDED Requirements

### Requirement: Pipeline 编排引擎

系统 SHALL 按固定顺序执行 8 个阶段（采集→URL验证→确定性处理→选题→生成→渲染→校验→归档），每个阶段有明确的输入文件和输出文件。

#### Scenario: 正常执行完整流水线
- **WHEN** 用户触发日报生成（指定日期或默认当日）
- **THEN** 系统依次执行 Phase 1-8，每阶段完成后将输出写入对应文件，最终在 `output/<date>/` 下生成 article.md、script.md、manifest.json，并更新 output/index.json

#### Scenario: Phase 1 采集为空（Fatal）
- **WHEN** Phase 1 采集结果 raw.json 中 items 数组为空
- **THEN** 系统立即终止，返回 `{ status: 'fatal', reason: 'no_raw_items', phase: 'collect' }`

#### Scenario: Phase 4 选题为空（Fatal）
- **WHEN** Phase 4 LLM 未选中任何条目（curated.json 的 selected_items 为空数组）
- **THEN** 系统立即终止，返回 `{ status: 'fatal', reason: 'no_curated_items', phase: 'curate' }`

### Requirement: 错误分级（Fatal / Recoverable）

系统 SHALL 将错误分为 Fatal（立即终止）和 Recoverable（降级继续）两类。Fatal 错误包括：raw 为空、candidates 为空、curated 为空、生成结果为空且重试失败。Recoverable 错误包括：单源 RSS 失败、单条 URL 404、Schema 校验失败（重试一次）、内容校验不通过。

#### Scenario: 单个 RSS 源返回 403（Recoverable）
- **WHEN** 某个 RSS 源（如 OpenAI）返回 HTTP 403
- **THEN** 系统跳过该源，记录到 manifest.sources.failed 数组，继续执行

#### Scenario: Schema 校验失败后重试成功
- **WHEN** Phase 5 LLM 输出的 JSON 不符合 Schema
- **THEN** 系统重试一次 LLM 生成；若重试成功则继续，若仍失败则终止（Fatal）

#### Scenario: 内容校验不通过
- **WHEN** Phase 7 内容校验检测到空洞表述超过 3 处
- **THEN** 系统继续写入文件，但 manifest.validate.validation_passed 标记为 false

### Requirement: Manifest 完整记录

每次运行 SHALL 生成 manifest.json，包含：date、pipeline_version、prompt_version、renderer_version、schema_version、llm_model、sources 统计、pipeline 各阶段耗时和统计、quality 指标、input_hashes、output_hashes、duration_total_s。

#### Scenario: 正常运行生成 manifest
- **WHEN** 流水线完整执行完毕
- **THEN** manifest.json 包含所有必需字段，input_hashes 为 raw/candidates/curated 文件的 sha256，output_hashes 为 article/script 的 sha256

#### Scenario: 版本字段用于问题定位
- **WHEN** 某次日报质量下降，需要定位原因
- **THEN** 通过 manifest 中的 pipeline/prompt/renderer/schema 四个版本号可以区分是哪个组件变更导致的问题

### Requirement: Pipeline Versioning

所有中间产物（raw.json、candidates.json、curated.json、article.json、script.json）和 manifest.json SHALL 包含 `pipeline_version` 字段。

#### Scenario: 版本兼容性检查
- **WHEN** pipeline 升级到 v4，读取 v3 生成的历史 curated.json
- **THEN** 可通过 pipeline_version 字段识别数据版本，决定是否需要迁移

### Requirement: Workflow 入口

系统 SHALL 通过 `ai-ribao-daily.js`（Claude Code Workflow）作为唯一入口。`run-workflow.sh` 保留作为 shell 包装器。

#### Scenario: 通过 Workflow 触发
- **WHEN** 用户运行 `ai-ribao-daily` workflow（可传入 args.date）
- **THEN** 系统使用 args.date 或默认当日日期执行完整流水线

#### Scenario: 通过 shell 触发
- **WHEN** 用户运行 `bash scripts/run-workflow.sh --date=2026-06-22`
- **THEN** 系统调用 Workflow 并传入对应日期参数
