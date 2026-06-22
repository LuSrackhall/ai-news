# AI 日报 操作手册

## 日常操作流程

### 1. 每日自动生成（推荐）

1. 运行 `/ai-ribao-daily` 或 `bash scripts/run-workflow.sh`
2. 等待 Pipeline 完成（约 2-3 分钟）
3. 检查 `output/<date>/manifest.json` 确认 `validation_passed: true`
4. 检查 `output/<date>/article.md` 和 `script.md`

Pipeline 执行过程中会输出每个 Phase 的进度日志，若任何阶段出现 Fatal 错误会提前终止并报告原因。

### 2. 质量审核检查清单

- [ ] 文章是否包含所有必需板块？
- [ ] deep_items 是否有具体数字支撑？
- [ ] 编辑观点是否有明确立场？
- [ ] URL 是否全部可点击？
- [ ] 口播稿时长是否在 3-5 分钟？
- [ ] 文章与口播稿选取是否一致？

### 3. 信源管理

**新增信源**
编辑 `scripts/config.mjs`，在 `RSS_SOURCES` 数组中添加条目，设置合适的 `tier`、`language`、`category` 等字段。无需修改其他文件。

**禁用信源**
设置 `enabled: false` 或 `status: 'disabled'`。

**健康检查**
查看 `data/source-health.json`，关注 `failStreak` 字段。连续失败 3 天会告警，7 天建议禁用。

**质量评估**
查看 `output/<date>/feedback.json`，关注 `entity_performance` 和 `event_type_stats` 变化趋势。

### 4. Prompt 迭代

1. 编辑 `prompts/v1/` 下的模板文件（curation.md / article.md / script.md）
2. 添加好案例到 `prompts/examples/`（good_editorials.json / good_hooks.json）
3. 递增 `config.mjs` 中的 `PROMPT_VERSION`
4. 运行新一期日报，对比 `feedback.json` 中的保留率和对齐率变化

### 5. 故障排查

| 问题 | 排查路径 |
|------|----------|
| 采集失败 | 检查 `data/source-health.json`，确认源 URL 可访问 |
| 评分异常 | 检查 `output/<date>/candidates.json` 的评分分布 |
| 生成质量差 | 检查 `output/<date>/article.json` 是否符合 Schema |
| 校验失败 | 检查 `output/<date>/manifest.json` 的 validate 部分 |
| RSS 源持续 403 | 检查 failStreak，考虑更换 URL 或设置 `enabled: false` |

---

## 人工审核要点（关键环节）

### 1. 事实核查（最高优先级）

- 检查 `deep_items` 中的具体数字是否与 `curated.json` 一致
- 检查来源链接是否真实可访问
- 检查是否有编造的公司名或人名

Pipeline 会自动检测幻觉 URL 并记录在 `manifest.json` 的 `hallucinated_url_count` 字段，但人工复核仍是必要的。

### 2. 编辑观点审核

- 观察是否基于今日新闻？（不是泛泛的趋势总结）
- 证据是否引用了具体事实？
- 判断是否可反驳？（不是废话）
- 预测是否合理？

prompt 中通过 `good_editorials.json` 示例引导模型输出有立场的观点，审核时应关注观点质量是否符合预期。

### 3. 口播稿审核

- 是否口语化？（没有长句、书面语）
- 数字是否口语化表达？
- 过渡句是否自然？
- 总时长是否在 3-5 分钟范围？

口播稿 JSON 中每个段落附带 `duration_s` 字段，加总即可估算时长。

---

## 用户反馈收集

在文章底部可添加反馈链接/表单，收集：

- 这期日报最有价值的 1 条新闻
- 这期日报最不值得报道的 1 条新闻
- 编辑观点是否同意？
- 整体评分 (1-5)

反馈数据可用于：

- 调整 `config.mjs` 中的评分权重（`ENTITY_WEIGHTS`、`EVENT_TYPE_WEIGHTS`）
- 优化 `prompts/examples/` 中的示例库
- 改进信源配置（启用/禁用/调整 tier）

---

## 版本管理

各组件版本独立管理，在 `config.mjs` 中配置：

| 变量 | 说明 | 当前值 |
|------|------|--------|
| `PIPELINE_VERSION` | 整体流水线版本 | v3 |
| `PROMPT_VERSION` | Prompt 模板版本 | v1 |
| `RENDERER_VERSION` | 渲染器版本 | v1 |
| `SCHEMA_VERSION` | JSON Schema 版本 | v1 |

修改 Prompt 后递增 `PROMPT_VERSION`，修改渲染逻辑后递增 `RENDERER_VERSION`，便于回溯效果对比。
