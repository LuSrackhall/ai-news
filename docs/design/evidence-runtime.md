# Evidence Runtime — 证据运行时

## 动机

日报中的「佐证图片」不应只是 RSS 信源的 og:image 缩略图。
真正的问题是：对一条新闻事件，系统如何自动找到最能支撑该事件判断的视觉证据？

Evidence Runtime 是独立于内容生成（Article Pipeline）的证据资产管道。
它和 Provenance Layer 是互补关系：

```
Provenance: 事件从哪里来（来源血缘）
Evidence:   凭什么相信（事实证据）
```

## 架构总览

```
                    Event
                      |
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
   Article Pipeline        Evidence Pipeline
   (内容生成)               (证据采集)
          │                       │
          ▼                       ▼
   article.json          evidence.json + png
          │                       │
          └───────────┬───────────┘
                      │
                      ▼
              Artifact Renderer
                      │
                      ▼
              article.md/html
```

Evidence 是一等产物，不是文章渲染的附属品。

## Evidence Model

```json
{
  "id": "evt_<hash>",
  "event_id": "apple-openai-lawsuit",

  "source": {
    "url": "https://theverge.com/...",
    "type": "news",
    "publisher": "The Verge",
    "collected_at": "2026-07-11T08:00:00Z"
  },

  "method": {
    "extractor": "playwright",
    "strategy": "keyword_paragraph",
    "selector": "article p:nth-child(17)",
    "keywords": ["Apple", "lawsuit", "trade secret", "OpenAI"]
  },

  "claim": {
    "text": "Apple filed lawsuit against OpenAI alleging trade secret theft",
    "segment": "Apple today filed a lawsuit against OpenAI...",
    "offset_start": 120,
    "offset_end": 180
  },

  "asset": {
    "type": "screenshot",
    "path": "images/2026-07-11/evidence/apple-openai-001.png",
    "mime": "image/png",
    "width": 800,
    "height": 600
  },

  "scoring": {
    "keyword_match": 0.91,
    "source_authority": 0.85,
    "provenance_crosscheck": 0.78,
    "overall": 0.86
  }
}
```

## Lifecycle

```
Event Qualified → ProvenanceEdge Built
        ↓
EvidenceCollector 拾取未处理的 event_id
        ↓
1. 解析 source.url → 识别源类型（news / github / arxiv / pdf）
2. 选择对应的 Extractor Adapter
3. 加载页面 → DOM 清理 → 内容区定位
4. 关键词评分 → 选取最优段落
5. Element Screenshot
6. 写入 evidence.json + png
        ↓
Evidence 存入 output/production/ai/<date>/evidence/
        ↓
Renderer 消费 evidence[] → 嵌入 article.md
```

## Adapter 接口

每个源类型实现一个 Extractor：

```javascript
class ExtractorAdapter {
  static supportedTypes() { return ['news', 'github', 'arxiv', 'pdf'] }

  async extract(url, event) {
    // 1. 加载页面
    // 2. 定位内容区
    // 3. 关键词评分段落
    // 4. 返回 { paragraphs: [{text, score, selector}], metadata: {} }
  }

  async screenshot(page, bestParagraph, outputPath) {
    // element.screenshot({ path: outputPath })
  }
}
```

默认内置 Adapter：

| Type | 策略 | 降级 |
|------|------|------|
| news | article + 关键词段落 | 首屏截图 |
| github | README section | 全页 |
| arxiv | abstract + figure | 摘要区 |
| generic | main content | 首屏 |

## Evidence Ranker

Ranker 接收多个候选证据，输出排序后的证据列表：

```
输入: 同一事件的多源候选证据
        ↓
1. KeywordMatchScore — DOM 关键词匹配密度
2. SourceAuthorityScore — 信源权威性（来自 ProvenanceAlias trust_score）
3. ProvenanceCrosscheckScore — 同一事件多源交叉验证
4. TemporalRecency — 发布时间权重
5. EntityConsistency — 提取实体与事件实体的重合度
        ↓
输出: Evidence[] 按 overall 降序
```

## LLM 的定位

### LLM 不参与（确定性层）
- 页面抓取
- DOM 定位
- 关键词匹配评分
- 截图
- 路径写入

### LLM 可参与（质量层）
- 截图是否包含 claim（Vision）
- 多个证据哪个更可信（排序）
- 生成证据摘要

```
Deterministic Layer: 发现 → 抓取 → 定位 → 截图 → 排序
        ↓ 产出候选证据
LLM Layer: 理解 → 评价 → 解释
        ↓ 仅对重要 deep_item 使用
```

## 与 Provenance 的关系

```
BuildProvenanceEdges          BuildEvidenceAssets
(已有)                         (新增)
        │                              │
        ▼                              ▼
来源关系                         证明关系
"事件从哪里来"                  "为什么相信这个判断"
        │                              │
        ▼                              ▼
ProvenanceEdge:                EvidenceNode:
  from_id → to_id               event_id → asset_path
  relation: duplicate_of        score: 0.86
```

EvidenceNode 可以挂载到 ProvenanceEdge 上：

```
TechCrunch 报道 Apple 诉讼
        │
        ├── ProvenanceEdge: 来源关系
        │   └── 从同一事件的 The Verge 报道去重
        │
        └── EvidenceNode: 证据关系
            └── 截图第17段显示 "Apple filed lawsuit"
```

## Pipeline 集成

新增独立 Task（在 editorial pipeline 中）：

```javascript
// scripts/tasks-evidence/build-evidence-assets.mjs
class BuildEvidenceAssets {
  async execute(ctx) {
    const events = ctx._curatedEvents || ctx._events || []
    const collector = new EvidenceCollector()

    for (const event of events) {
      if (!event.url) continue
      const evidence = await collector.collect(event)
      ctx._evidenceAssets = ctx._evidenceAssets || []
      ctx._evidenceAssets.push(evidence)
    }

    return ExecutionResult.ok({ evidence_count: ctx._evidenceAssets.length })
  }
}
```

Editorial pipeline 插入位置：

```
Step 3:  选题 → curated.json
Step 3.5: BuildEvidenceAssets → 对选中事件采集证据
Step 4:  文章生成 → article.json（引用 evidence[]）
Step 5:  渲染 → article.md（嵌入截图）
```

## 存储

```
output/
 production/
  ai/
   <date>/
    evidence/
     <event-id>/
      evidence.json    ← 元数据
      screenshot.png   ← 截图文件
```

article.json 引用：

```json
{
  "deep_items": [{
    "id": "apple-openai-lawsuit",
    "evidence": [
      {
        "type": "screenshot",
        "path": "images/2026-07-11/evidence/apple-openai-001.png",
        "caption": "The Verge 报道原文显示 Apple 指控 OpenAI 窃取商业机密",
        "confidence": 0.86
      }
    ]
  }]
}
```

## 迁移路径

### Phase 1 — Evidence Runtime Kernel（当前）

纯代码，不引入 LLM。

```
实现:
  scripts/evidence/collector.mjs
    - Playwright 加载页面
    - DOM 清理脚本（去广告/导航/弹窗）
    - 内容区定位（article / main / .post-content）
    - 关键词评分段落（title + entities → 关键词）
    - Element screenshot
    - 写入 evidence.json + png

  scripts/evidence/scorer.mjs
    - 纯代码评分（keyword match + source authority）
    - 多源交叉验证（利用 ProvenanceEdge duplicate_of）

集成:
  editorial pipeline 新增 BuildEvidenceAssets
  render-article.mjs 消费 evidence[] 字段
```

### Phase 2 — LLM Judge

```
新增:
  scripts/evidence/judge.mjs
    - Vision model 校验截图质量
    - 摘要生成

仅对 importance=deep 的事件启动
```

### Phase 3 — Evidence Graph

```
证据间关联关系：
  evidence A supports claim X
  evidence B contradicts claim Y

扩展到更多源类型：
  PDF（法院文书、财报）
  GitHub（Release note、commit diff）
  视频关键帧
```
