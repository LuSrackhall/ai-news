# Execution Runtime

> Execution Runtime 是 Pipeline 执行引擎，负责将 Task 定义为 Pipeline，编排执行顺序，管理上下文传递。
>
> 本文档是 `constitution.md` 中 Runtime Layer 的扩展。

## 职责

- Pipeline 编译：将 declarative pipeline 转换为可执行图
- Task 注册和解析：按 ID 从 Registry 实例化 Task
- 上下文管理：`ctx._xxx` 在 Task 之间传递数据
- 执行追踪：记录每个 step 的执行结果、耗时、状态
- 错误传播：Fatal → Pipeline 终止，Error → Step 降级

## 三个 Runtime 共享同一套 Execution Runtime

Ingestion、Editorial、Generation 三个 Runtime 都基于同一套 Execution Runtime 框架：

```
TaskRegistry → compile(pipeline) → runtime.execute(graph, ctx) → session.toResult()
```

## 不负责

- 具体的 Task 逻辑（由各 Runtime 的 Task 实现）
- Pipeline 的步骤顺序逻辑（由 Pipeline 声明定义）
- 数据持久化（由 Repository 和 ReadModel 处理）

---

*Version 1.0 · 2026-07-04*
