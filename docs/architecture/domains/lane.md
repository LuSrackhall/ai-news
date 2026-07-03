# Lane Domain

> Lane（编辑轨道）是 Editorial Runtime 的一级编排单元。每个 Lane 代表一个独立的编辑轨道，负责处理同一类型的信息。

## 原则

1. **互斥性**：一个 Event 有且仅有一个主 Lane
2. **独立性**：Lane 之间不共享状态、不互相调用
3. **可配置性**：具体 Lane 集合由 Runtime Configuration 定义，不是硬编码
4. **零下限**：某天某个 Lane 的候选池可以为空——Merge 不为其填充

## 结构

```
Lane = Context + Rules + CandidateBuilder

Context = { maxSize, domain, config }
Rules  = Rule[]       // 可复用已有 Rule
```

## Lane 与 Domain 的关系

`editorialDomain` 是 Event 的属性（在 Ingestion 阶段由 EntityExtraction + EventTypeRule 确定），Lane 是 Runtime 的编排单元。两者一一映射，但：

- **Domain** = 数据模型概念（Event 有什么属性）
- **Lane** = 运行时概念（如何在 Pipeline 中编排）

---

*Version 1.0 · 2026-07-04*
