# Candidate Domain

> Candidate 是 Editorial Runtime 产出的编辑视图，是 Event 的轻量包装。
> Candidate 具有临时性——生命周期限于单次 Pipeline 执行，不持久化。

## 属性

| 字段 | 类型 | 说明 |
|------|------|------|
| event | Event | 原始 Event 引用（只读） |
| finalRank | number | score + Editorial Signals boost |
| contextHints | string[] | LLM 上下文提示 |
| signals | EditorialSignal[] | 该 Candidate 关联的所有 Signal |

## 生命周期

```
Read Events
    ↓
Build Candidates
    ↓
LLM Consumes
    ↓
Destroy
```

Candidate 不是数据库里东西。它只在 Editorial Pipeline 执行过程中存在。

---

*Version 1.0 · 2026-07-04*
