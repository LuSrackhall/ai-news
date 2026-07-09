# Provenance Layer v1 — 证据血缘层架构设计

> 设计文档 — 2026-07-09

---

## Context

日报当前来源标注存在结构性缺陷：事件仅保存最后一跳的 RSS 聚合器名称（36氪、虎嗅），丢失了原始信息源头。4 人评估团队调研确认：

- **22%** 的 36氪事件可通过 summary 尾部括号提取真实原始源
- **95%** 的虎嗅事件来自微信公众号，但公众号名称嵌在 HTML 正文中，无结构化提取入口
- RSS `<source>` 标签覆盖率 **0%**
- 当前 `collect-rss.mjs` 仅提取 5 个字段，丢弃了 `dc:creator`、`<category>`、`<source>` 等标准 RSS 元素

这不是附加功能，而是 Editorial Intelligence 架构 v2 定义的 Phase 2（Provenance）的落地。

## 概念模型

从"来源"升级为"证据血缘"：

```
Asset（RSS 采集条目）
  ├── Origin Source    ← 一手来源（OpenAI Blog / arXiv）
  ├── Chain            ← 转载链（Reuters → 36氪）
  ├── Evidence Count   ← 独立来源数
  └── Source Family    ← 递归到真实 Origin
```

数据模型采用 DAG（有向无环图），节点为 Asset，边为引用关系。

## Goals

- 建立 Provenance Layer 数据模型（Asset + Edge + Source Family Cache）
- 三层提取策略：RSS 元数据 → HTML 正文解析 → LLM 推断
- 三个消费方：VerificationSignal / FirstSourceSignal / EvidenceCountSignal
- 分层来源链渲染（Assembly）

## Key Decisions

### D1: 三表 + CTE
provenance_assets / provenance_edges / source_family_cache。
events 表新增 origin_asset_id / multi_source_count / origin_tier。

### D2: 三层提取
RSS 元数据（P0, 5行正则） → HTML 正文解析（P1） → LLM 推断（P2）

### D3: 三个消费信号
- VERIFICATION（FILTER, multi_source >= 3）
- FIRST_SOURCE（RANK, tier 1 +15）
- EVIDENCE_COUNT（RANK, 滑动 5/10/15）

### D4: 分层渲染
来源链显示代替扁平列表。

## 表结构

provenance_assets: id, content_hash, url, publisher, publisher_tier, title, published_at, extracted_author, extracted_category, extracted_source, attributed_source, attribution_type, metadata
provenance_edges: id, from_id, to_id, relation('cites'|'clustered_into'), created_at
source_family_cache: asset_id, root_origin, chain_depth, chain_json, computed_at

## Risks

- DAG CTE 性能 → 预计算缓存 + 深度上限 5
- LLM 推断幻觉 → attribution_type='llm_inferred' 标记
- 覆盖率渐进 → P0/P1/P2 分阶段
