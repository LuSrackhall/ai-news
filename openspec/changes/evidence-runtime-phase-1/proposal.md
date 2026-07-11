## Why

日报的「佐证图片」目前依赖 RSS 信源的 og:image 缩略图，与报道内容关联弱，不具备证据价值。需要建立独立于文章生成的证据采集管道（Evidence Runtime），对已选题事件自动从源 URL 中定位并截取关键段落，生成真正的视觉证据资产。

## What Changes

- 新增 `scripts/evidence/collector.mjs` — Playwright 驱动的证据采集器
- 新增 `scripts/evidence/scorer.mjs` — 纯代码评分器（关键词匹配 + 信源权威 + 多源交叉）
- 新增 `scripts/evidence/model.mjs` — Evidence 数据模型
- 新增 `scripts/evidence/keywords.mjs` — 事件关键词提取
- 新增 `scripts/tasks-evidence/build-evidence-assets.mjs` — editorial pipeline Task
- 修改 `scripts/tasks-editorial/render-artifacts.mjs` — 传递 evidence 上下文
- 修改 `scripts/render-article.mjs` 和 `scripts/policies/render-policy.mjs` — 消费 evidence[] 渲染图片
- 安装 Playwright（devDependency）

## Capabilities

### New Capabilities
- `evidence-runtime`: 证据运行时——对已选题事件从源 URL 自动定位关键段落并截图，产出 evidence.json + png，支持关键词评分、多源交叉验证，输出被 article renderer 消费。

### Modified Capabilities
- （无现有 spec 的改变）

## Impact

- 新增依赖：Playwright（仅开发/CI 环境）
- 新增目录：`scripts/evidence/`（采集器、评分器、模型）
- 新增目录：`scripts/tasks-evidence/`（BuildEvidenceAssets task）
- 输出目录增加 `evidence/<event-id>/` 子结构
- article.json 的 deep_items 和 important_items 增加可选的 evidence[] 字段
- render-article.mjs 和 render-policy.mjs 支持 `![evidence](path)` 渲染
