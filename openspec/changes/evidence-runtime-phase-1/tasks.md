## 1. 安装 Playwright 依赖

- [x] 1.1 `npm install --save-dev playwright` + `npx playwright install chromium`
- [x] 1.2 验证 `node -e "const { chromium } = require('playwright'); (async () => { const b = await chromium.launch(); await b.close(); })()"` 可正常启动

## 2. Evidence 词干模块

- [x] 2.1 创建 `scripts/evidence/` 目录和 `scripts/evidence/model.mjs` — Evidence 数据模型（evidence.json 的 schema 定义、序列化/反序列化）
- [x] 2.2 实现 `scripts/evidence/keywords.mjs` — 从事件 title/summary/entities 生成关键词列表，支持中英文分词和实体提取

## 3. EvidenceCollector

- [x] 3.1 实现 `scripts/evidence/collector.mjs` — Playwright 加载页面核心逻辑：launch browser、加载 URL、waitForSelector、networkidle、超时处理
- [x] 3.2 实现 DOM 清理脚本：注入 JS 移除广告（.ad, .advertisement, ins.adsbygoogle）、弹窗（cookie consent、newsletter popup、login modal）、干扰元素（nav, footer, sticky headers）
- [x] 3.3 实现内容区定位逻辑：优先 `<article>` → `[role="main"]` → `.post-content` → `body`
- [x] 3.4 实现关键词评分段落定位：遍历内容区 `<p>`，对每个段落按关键词匹配评分，选最高分段
- [x] 3.5 实现 Element Screenshot + 降级策略：有匹配段落 → element.screenshot()；无匹配 → 内容区全截图；付费墙 → skip + confidence:0
- [x] 3.6 实现证据保存：写入 output/production/ai/<date>/evidence/<event-id>/evidence.json + screenshot.png

## 4. EvidenceScorer

- [ ] 4.1 实现 `scripts/evidence/scorer.mjs` — KeywordMatchScore 计算（关键词命中密度）
- [ ] 4.2 实现 SourceAuthorityScore — 通过 ProvenanceService 查询 publisher trust_score
- [ ] 4.3 实现 ProvenanceCrosscheckScore — 通过 ProvenanceService 查询事件的 duplicate_of 边数
- [ ] 4.4 集成三因子等权平均 → overall score

## 5. BuildEvidenceAssets Task

- [ ] 5.1 创建 `scripts/tasks-evidence/build-evidence-assets.mjs` — 遍历 ctx._curatedEvents，对每个有 url 的事件执行 EvidenceCollector
- [ ] 5.2 容错：单个事件失败不中断 pipeline，跳过继续
- [ ] 5.3 输出：ctx._evidenceAssets 传入后续 Task

## 6. Pipeline 集成

- [ ] 6.1 在 `scripts/pipelines/editorial.mjs` 的选题(Step3)和文章生成(Step4)之间插入 BuildEvidenceAssets
- [ ] 6.2 在 `scripts/run-editorial.mjs` 的 registerAll 中注册 BuildEvidenceAssets
- [ ] 6.3 在 `scripts/tasks-editorial/render-artifacts.mjs` 中读取 ctx._evidenceAssets 传入 renderer
- [ ] 6.4 注册新 task 文件路径到 `scripts/pipelines/editorial.mjs` 和 `scripts/run-editorial.mjs`

## 7. Renderer 消费证据

- [ ] 7.1 修改 `scripts/render-article.mjs` — deep_item.evidence[] 渲染 `![caption](path)` 在标题后内容前；important_item.evidence[] 渲染 `![title](path)` 在标题后摘要前
- [ ] 7.2 修改 `scripts/policies/render-policy.mjs` — 同上，管道渲染器

## 8. 集成测试

- [ ] 8.1 对 2026-07-11 的已选题事件（Apple诉OpenAI、Meta深伪造）运行 collector，验证截图产出
- [ ] 8.2 验证评分器输出符合预期
- [ ] 8.3 验证 renderer 输出正确包含图片
- [ ] 8.4 运行完整 editorial pipeline 验证端到端

---

## Post-Implementation Workflow

<!-- DO NOT MODIFY THIS SECTION — it defines the required workflow after all tasks are complete -->

After completing ALL tasks above, follow this sequence strictly:

1. **Verify**: Run `/opsx:verify` to produce verify.md
2. **User Acceptance**: Present change summary, ask user to confirm the problem is solved
3. **Merge**: After user accepts, go to main branch and merge (must ask user)
4. **Archive**: Run `/opsx:archive` on main
5. **Cleanup**: `git worktree remove .worktrees/change/<name>`

**Iteration**: If user does not accept, analyze the issue and recommend:
fix in place / new change / git reset + stash / git reset / abandon.
