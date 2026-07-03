# Architecture Documentation

> 项目架构文档体系。建议按以下顺序阅读。

## 阅读顺序

```text
0. glossary.md               ← 先读术语表（理解统一语言）
1. constitution.md            ← 项目最高层宪法（6 条不变量）
2. runtimes/                  ← 理解三个 Runtime
   ├── ingestion.md           ← 事实获取
   ├── editorial.md           ← 编辑编排 (Lane + Merge + Candidate Builder)
   └── execution.md           ← Pipeline 执行引擎
3. domains/                   ← 核心数据模型
   ├── event.md
   ├── candidate.md
   ├── publication.md
   └── lane.md
4. adrs/                      ← 理解为什么这样设计
   └── ADR-0*.md
```

## ADR Status

ADR 使用以下状态标识生命周期：

| Status | 含义 |
|--------|------|
| `PROPOSED` | 提议中，待评审 |
| `ACCEPTED` | 已被采纳，当前有效 |
| `SUPERSEDED` | 被后续 ADR 替代 |
| `DEPRECATED` | 已废弃，不再使用 |

## 索引

| 文档 | 内容 | 必读 |
|------|------|------|
| `glossary.md` | 统一术语表 | ✅ |
| `constitution.md` | 6 条不变量 | ✅ |
| `runtimes/editorial.md` | Lane 模型、Merge Policy、Runtime Model 图 | ✅ |
| `runtimes/ingestion.md` | Ingestion 流水线、Event 产出 | |
| `runtimes/execution.md` | Task Registry、Pipeline 编译、Session 管理 | |
| `domains/*.md` | 核心数据模型定义 | |
| `adrs/ADR-*.md` | 架构决策记录 | |

---

*2026-07-04*
