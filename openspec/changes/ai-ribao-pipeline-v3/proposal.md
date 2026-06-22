## Why

AI 日报系统存在 6 个已确认的工程问题：文章/脚本内容互换（parallel 返回顺序不确定）、LLM 推理泄漏到产出文件（归档 agent 不清洗直接写入）、跨日重复内容（去重从未执行）、arXiv 论文全部同分（评分维度高度共线）、死链残留（URL 验证位置偏晚）、36kr 噪音过高。系统需要从「LLM agent 自由发挥」转变为「代码驱动的确定性 Pipeline」，以支撑长期每日稳定运行。

## What Changes

**架构重构：** 从 6 阶段 Agent Workflow 重构为 8 阶段 Pipeline 驱动架构。LLM 仅负责 Phase 4（语义选题）和 Phase 5（内容生成），其余 6 个阶段全部由 Node.js 代码驱动。

**关键变更：**
- **BREAKING** Phase 6 归档从 LLM agent 改为代码直接写文件，消除内容互换和推理泄漏
- **BREAKING** Phase 5 从 parallel 改为串行执行（先文章后口播稿），消除返回顺序不确定
- **BREAKING** Phase 5 LLM 输出从 Markdown 改为结构化 JSON，Phase 6 Renderer 渲染为 Markdown
- Phase 2 URL 验证前置（采集后立即淘汰死链，不进入评分）
- Phase 3 评分算法重构为 Base Score + Bonus 分层（影响力权重从 20% 提升至 35%，引入实体/事件/量化三维打分）
- Phase 3 跨日去重改为三级策略（URL 精确 → 事件指纹+DateBucket → 标题 bigram 相似度）
- 新增 Phase 7 Schema Validation + 内容质量校验
- 新增错误分级（Fatal/Recoverable），单源异常不阻塞全局
- 新增完整 Manifest（含 pipeline/prompt/renderer/schema 四版本号 + input/output hashes）
- 数据源扩展：修复 OpenAI RSS URL、切换英文媒体到 AI 专题 feed、新增 DeepMind/VentureBeat/Import AI 等源

## Capabilities

### New Capabilities
- `pipeline-engine`: 8 阶段 Pipeline 编排引擎，含错误分级、manifest 生成、版本管理
- `deterministic-processing`: Phase 3 确定性处理（normalize + filter + score + dedup），含 Base+Bonus 评分算法和三级跨日去重
- `content-renderer`: Phase 6 JSON → Markdown 渲染器（Formatter + Template），支持多平台扩展
- `quality-gate`: Phase 7 Schema Validation + 内容质量校验（空洞表述检测、URL 交叉比对、字数约束）
- `data-sources`: 数据源配置扩展（AI 专题 feed、新增源、36kr 关键词过滤、WebSearch 补充策略）

### Modified Capabilities
（无现有 spec 需要修改）

## Impact

**受影响的文件：**
- `.claude/workflows/ai-ribao-daily.js` — 完全重写（从 agent 调用改为 pipeline 编排）
- `scripts/config.mjs` — 评分配置重构（Base+Bonus）、数据源扩展、新增实体/事件权重表
- `scripts/collect-rss.mjs` — 新增 URL 验证逻辑、影响力预评分
- `scripts/pipeline-runner.mjs` — 废弃或大幅简化（不再是 blueprint，改为 pipeline 引擎）
- `scripts/run-workflow.sh` — 简化入口，委托给 pipeline 引擎
- 新增 `scripts/dedup.mjs` — 跨日去重模块
- 新增 `scripts/render-article.mjs` + `scripts/render-script.mjs` — Renderer
- 新增 `scripts/validate-output.mjs` — 校验模块
- 新增 `scripts/score.mjs` — Base+Bonus 评分模块

**风险：**
- JSON Renderer 增加初始开发量（一次性投入，后续零维护成本）
- 事件指纹 DateBucket 可能误杀月末跨周新闻（TopKeywords 保留 3 个缓解）
- Phase 4 不允许改写事实可能限制 LLM 灵活性（有意约束：事实准确性 > 表达灵活性）
