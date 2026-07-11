## Context

已有 `docs/design/evidence-runtime.md` 完整架构文档。本文档聚焦 Phase 1 实现的模块结构、数据流和集成细节。

当前 editorial pipeline: `选题(Step3) → 文章生成(Step4) → 渲染(Step5)`
实现将插入 Step 3.5 (BuildEvidenceAssets)，在选题完成、文章生成前采集证据。

## Goals / Non-Goals

**Goals (Phase 1):**
- 确定性关键词评分段落定位（纯代码，无 LLM）
- Playwright Element Screenshot 产出 PNG
- 三因子评分器（keyword match + source authority + provenance crosscheck）
- editorial pipeline 集成（BuildEvidenceAssets task）
- Renderer 消费 evidence[] 字段

**Non-Goals (Phase 1):**
- LLM vision 校验（Phase 2）
- 非 news 类型的 Adapter（Phase 3）
- 证据间关联图（Phase 3）

## Decisions

1. **Playwright standalone chromium，非 Puppeteer**
   Playwright 社区活跃、跨浏览器、微软维护。`npx playwright install chromium` 仅安装 chromium，
   体积 ~300MB，仅开发/CI 环境安装。

2. **collector 内部状态机**
   ```
   load → cleanup → locate → score → screenshot → save
   ```
   每步可降级：score 无匹配 → locate fallback 到首屏截取。

3. **评分器三因子等权平均**
   Phase 1 不确定最优权重，等权平均 + 记入 evidence.json 各分量供后续调优。
   ProvenanceCrosscheck 利用 BuildProvenanceEdges 的 duplicate_of 关系。

4. **evidence 目录按 date/event-id 组织**
   ```
   output/production/ai/<date>/evidence/<event-id>/
     evidence.json
     screenshot.png
   ```

5. **evidence 注入由 RenderArtifacts 处理**
   Phase 1 中 evidence 不由 LLM 在文章生成环节引用，而是由 RenderArtifacts Task
   在渲染阶段从磁盘加载 evidence.json，按 event-id 匹配到 article deep/important item，
   再注入 evidence[] 字段。这样 LLM 无需感知 evidence，降低耦合和 prompt 复杂度。

6. **article.json 引用路径为相对路径**
   `"evidence": [{"path": "evidence/<event-id>/screenshot.png", ...}]`
   Renderer 在 article.md 中转为 `output/production/ai/<date>/` 下的相对引用。

## Risks / Trade-offs

- [Playwright 安装失败] → `npx playwright install --with-deps chromium` 自动处理系统依赖
- [页面需要登录/付费墙] → 检测到 paywall 时跳过截图，标注 confidence: 0
- [关键词评分选段错误] → 截取评分最高的 3 个候选段落区域合并输出
- [渲染时序] → waitForSelector('.article-body, article, [role="main"]') + networkidle
