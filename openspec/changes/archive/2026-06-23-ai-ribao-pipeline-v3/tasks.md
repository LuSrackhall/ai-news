## 1. 配置重构（config.mjs）

- [x] 1.1 修复 OpenAI RSS URL：`/news/rss` → `/news/rss.xml`
- [x] 1.2 切换 TechCrunch 到 AI 专题 feed：`/category/artificial-intelligence/feed/`
- [x] 1.3 切换 MIT Tech Review 到 AI 专题 feed：`/topic/artificial-intelligence/feed`
- [x] 1.4 切换 The Verge 到 AI 专题 feed：`/rss/ai-artificial-intelligence/index.xml`
- [x] 1.5 新增 Tier 1 源：DeepMind Blog
- [x] 1.6 新增 Tier 2 源：VentureBeat AI, Ars Technica AI, Import AI, The Batch
- [x] 1.7 扩充 AI_KEYWORDS：新增中国 AI 公司关键词（百度、文心、通义、千问、豆包、Kimi、智谱等）
- [x] 1.8 新增 ENTITY_WEIGHTS 配置（顶级公司=10, 重要公司=6, 机构人物=5）
- [x] 1.9 新增 EVENT_TYPE_WEIGHTS 配置（模型发布=10, 融资=8, 政策=7, 人才变动=5, 学术论文=3）
- [x] 1.10 新增 WebSearch 补充查询配置（6 个查询覆盖无 RSS 的官方源）
- [x] 1.11 新增 SCORING 配置重构：Base Score 四维（权威性20/时效性15/可验证性15/内容质量15）+ Bonus 四类
- [x] 1.12 新增同源上限配置：arXiv=5, TechCrunch=3, 36kr=3, 其他=3
- [x] 1.13 新增 pipeline_version, prompt_version, renderer_version, schema_version 常量
- [x] 1.14 新增 36kr 源的 requireKeywordFilter: true 标记

## 2. 采集阶段增强（collect-rss.mjs）

- [x] 2.1 在每条采集结果中新增 `impactScore` 字段（实体权重+事件类型+量化信号，代码预计算）
- [x] 2.2 学术源（arXiv）时间窗口从 24h 扩展到 48h
- [x] 2.3 支持 Tier 2 源的关键词过滤（36kr、Microsoft Research、NVIDIA 需要过滤）
- [x] 2.4 在每条结果中新增 `pipeline_version` 字段
- [x] 2.5 输出 JSON 中新增 `summary` 字段（采集时的 description 清洗后版本）

## 3. URL 验证模块（verify-urls.mjs）

- [x] 3.1 新建 `scripts/verify-urls.mjs`：接收 raw.json，对每条 URL 发 HEAD 请求（max-time 10s），移除 404/timeout/5xx
- [x] 3.2 输出 `valid_raw.json` + `failures.json`，记录每条移除的原因和 HTTP 状态码
- [x] 3.3 并发控制：最多 5 个并发请求，避免被源站限流

## 4. 评分模块（score.mjs）

- [x] 4.1 新建 `scripts/score.mjs`：实现 Base Score 四维计算（权威性、时效性、可验证性、内容质量）
- [x] 4.2 实现 Bonus 计算：实体权重（匹配 ENTITY_WEIGHTS）、事件类型（匹配 EVENT_TYPE_WEIGHTS）、量化信号（正则匹配金额/性能/规模）、学术信号（标题含热门话题/模型名/SOTA）
- [x] 4.3 实现 Final Score = min(Base + Bonus, 100)
- [x] 4.4 实现分级阈值：auto>=70, review 55-69, skip<55
- [x] 4.5 实现同源上限：超出限制的条目降级为 skip
- [x] 4.6 学术源跨分类加分：同一篇论文同时出现在 cs.AI 和 cs.CL 时权威性+3

## 5. 去重模块（dedup.mjs）

- [x] 5.1 新建 `scripts/dedup.mjs`：实现 Level 1 URL 精确匹配去重
- [x] 5.2 实现 Level 2 事件指纹匹配（Entity+EventType+Top3Keywords+DateBucket）
- [x] 5.3 实现 Level 3 标题 bigram 重叠度计算（阈值 0.5）
- [x] 5.4 加载最近 14 天的 curated.json 作为历史数据
- [x] 5.5 去重策略：keep_highest_score
- [x] 5.6 输出去重报告（每条移除的原因和匹配的历史条目）

## 6. Pipeline 引擎（ai-ribao-daily.js 重写）

- [x] 6.1 重写 `ai-ribao-daily.js`：8 阶段 Pipeline 编排（phase/log/agent 调用）
- [x] 6.2 Phase 1：调用 collect-rss.mjs，检查 raw_count > 0（否则 Fatal）
- [x] 6.3 Phase 2：调用 verify-urls.mjs，移除死链
- [x] 6.4 Phase 3：调用 score.mjs + dedup.mjs，输出 candidates.json（含 auto/review/skip 分级）
- [x] 6.5 Phase 4：agent() LLM 选题，只处理 review 区条目，输出 curated.json；约束只允许修改 importance 和 curation_note
- [x] 6.6 Phase 5a：agent() 生成 article.json（JSON Schema 约束），串行执行
- [x] 6.7 Phase 5b：agent() 生成 script.json（JSON Schema 约束），基于 curated.json + article.json
- [x] 6.8 Phase 5 JSON 解析兜底：截取第一个 `{` 到最后一个 `}` 再解析
- [x] 6.9 Phase 6：调用 render-article.mjs + render-script.mjs
- [x] 6.10 Phase 7：调用 validate-output.mjs，Schema 失败重试一次，内容校验不通过标记 manifest
- [x] 6.11 Phase 8：代码直接写文件（不用 agent），更新 index.json，生成 manifest.json
- [x] 6.12 实现错误分级：Fatal 返回 status:'fatal'，Recoverable 记录到 manifest 继续执行
- [x] 6.13 manifest 包含四版本号 + input_hashes + output_hashes + 各阶段耗时 + quality 指标

## 7. Renderer 模块

- [x] 7.1 新建 `scripts/render-article.mjs`：接收 article.json，输出 Markdown 文章
- [x] 7.2 Formatter 功能：中文标点规范化、引号统一、空行规范化、URL 确保可点击
- [x] 7.3 模板结构：标题 → 钩子 → 今日速览 → 重磅深度（四段） → 重要动态 → 快讯 → 编辑观点
- [x] 7.4 新建 `scripts/render-script.mjs`：接收 script.json，输出带时间标注的口播稿 Markdown
- [x] 7.5 Renderer 内含 renderer_version 常量

## 8. 校验模块（validate-output.mjs）

- [x] 8.1 新建 `scripts/validate-output.mjs`：实现 article.json Schema 校验（required: hook, summary_items, editorial）
- [x] 8.2 实现 script.json Schema 校验（required: hook, overview, closing）
- [x] 8.3 实现内容质量校验：URL 交叉比对、空洞表述检测（>3 处 FAIL）、口播时长 180-300s、editorial 字段长度 >30 字、deep_items 含数字
- [x] 8.4 输出校验结果 JSON（status, checks 数组, warnings 数组）

## 9. Shell 入口更新

- [x] 9.1 更新 `scripts/run-workflow.sh`：简化为委托给 Workflow 执行
- [x] 9.2 废弃 `scripts/pipeline-runner.mjs`（改为存档或删除）

## 10. 集成测试

- [x] 10.1 使用 2026-06-20 的 raw.json 数据运行完整 Pipeline，验证评分区分度
- [x] 10.2 验证跨日去重：用 06-20 的 curated.json 作为历史，运行 06-21 数据，确认重复条目被去重
- [x] 10.3 验证 Renderer 输出：article.md 包含所有必需板块，格式一致
- [x] 10.4 验证 manifest 字段完整性：四版本号、hashes、耗时、quality 指标
- [x] 10.5 验证错误分级：模拟 RSS 403（Recoverable）和 LLM 生成失败（Fatal）

---

## Post-Implementation Workflow

After completing ALL tasks above, follow this sequence strictly:

1. **Verify**: Run `/opsx:verify` to produce verify.md
2. **User Acceptance**: Present change summary, ask user to confirm the problem is solved
3. **Merge**: After user accepts, go to main branch and merge (must ask user)
4. **Archive**: Run `/opsx:archive` on main
5. **Cleanup**: `git worktree remove .worktrees/change/<name>`
