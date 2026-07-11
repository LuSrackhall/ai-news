## Context

日报中的「佐证图片」目前依赖 RSS 信源的 og:image 缩略图，与报道内容关联弱、不具备证据价值。现有方案只是通用配图，不是真正的视觉证据。

项目已有 Provenance Layer（来源血缘 DAG）和完整的 editorial pipeline。本轮为 Provenance + Evidence 能力的自然延伸——建立独立于文章生成的证据采集管道。

约束：
- 确定性逻辑优先，LLM 仅用于质量判断
- 与现有 TCA 架构一致
- 不引入新数据库或外部服务
- Playwright 是唯一新增依赖

## Goals / Non-Goals

**Goals:**
- 对已选题事件自动采集视觉证据（截图）
- 证据存储为独立产物（evidence.json + png）
- 确定性段落定位（关键词评分 → Element Screenshot）
- 多源交叉验证评分（利用 ProvenanceEdge duplicate_of）
- Renderer 消费 evidence[] 字段嵌入 article.md

**Non-Goals:**
- LLM vision 校验截图质量（Phase 2）
- PDF/GitHub/视频截图（Phase 3）
- Evidence Graph 关联（Phase 3）
- 替代现有 ProvenanceEdge（互补关系）

## Decisions

1. **独立 Pipeline 而非 Render 附属**
   Evidence 是一等产物。BuildEvidenceAssets 作为独立 Task 运行在 editorial pipeline 中（Step 3.5），不耦合 render。

2. **纯代码段落定位**
   事件 title/summary/entities → 关键词 → DOM 评分 → 最高分段 Element Screenshot。
   无需 LLM，可审计、可复现。

3. **评分器分层**
   - KeywordMatchScore（DOM 关键词匹配密度）
   - SourceAuthorityScore（ProvenanceAlias trust_score）
   - ProvenanceCrosscheckScore（同一事件多源交叉）
   - 三因子 → overall

4. **Evidence Model 设计**
   包含 method（如何采集的）、claim（证明了什么 claim）、asset（存储路径）、scoring（评分）。
   与 ProvenanceEdge 互补而非替代。

5. **存储与文章分离**
   evidence/ 目录存放截图和元数据，article.json 通过 evidence[] 字段引用。
   Renderer 读取后渲染 markdown 图片。

## Risks / Trade-offs

- [Playwright Chromium 体积] → 仅开发/CI 环境安装，不引入运行时依赖
- [页面布局变化导致定位失败] → 降级到内容区全截图
- [关键词评分不准确] → 支持多候选取最高分，引入超参调优
- [截图渲染差异（JS 动态加载）] → waitUntil: networkidle + 显式等待关键选择器
