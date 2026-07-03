# Architecture Constitution

> 本项目定义了一套编辑领域运行时架构（Editorial Runtime Architecture）。
> 本文档是项目的最高层架构宪法。所有实现和变更必须遵守其中定义的不变量。

## Layer Model

系统由四个架构层组成，依赖方向自上而下：

```
Application Layer
    │  Publication 配置、业务逻辑
    ▼
Runtime Layer
    │  Ingestion / Editorial / Generation 三组运行时
    ▼
Domain Layer
    │  Event、Candidate、Publication 等核心模型
    ▼
Infrastructure Layer
    │  SQLite、文件存储、外部服务
```

- 上层可以依赖下层，下层绝不知晓上层
- 同一层内的组件可以通过接口协作，不鼓励直接依赖实现

## Runtime Boundary

| Runtime | 职责 | 不负责 |
|---------|------|--------|
| Ingestion Runtime | 获取、验证、规范化、聚类、存储事实 | 编辑判断、内容生成 |
| Editorial Runtime | 组织、筛选、编排、合并候选内容 | 事实采集、文章渲染 |
| Generation Runtime | 将候选池转换为最终表达形式 | 编辑决策、事实修改 |

**核心原则：Editorial Runtime 不创造事实，只组织事实。**

## LLM Boundary

LLM 在整个系统中的角色是约束性的：

- LLM **可以对已有事实进行组织和表达**（curation、写作、改写）
- LLM **不可以修改、创造或删除事实**（Event 的 title、url、source 等字段）
- LLM **不参与 ranking 或 scoring 决策**（这些由确定性规则处理）
- LLM **对候选题目的选择权优先于排序，但不能引入事实库中不存在的信息**

违反这些约束的设计必须经过 Constitution 修订流程。

## Data Flow

```
Facts (Ingestion)
    ↓
Editorial (组织和筛选)
    ↓
Generation (表达)
    ↓
Artifact (最终产出)
```

每一层只对自己产出的数据负责：

- Ingestion 产出 Event（事实）
- Editorial 产出 Candidate（编辑视图）
- Generation 产出 Artifact（文章、播客脚本）

## Publication Composition

Publication 不是代码，而是配置。一个 Publication 由以下组合定义：

```
Publication = EditorialStrategy + PromptSet + RenderPolicy

EditorialStrategy = LaneSet + RuleSet + MergePolicy
```

未来新增 Publication 不需要修改核心运行时代码。

## Revision

本文档的不变量只能通过 Architecture Review 修改。修改建议以 ADR 形式提交，经过评审后更新版本号。

---

*Version 1.0 · 2026-07-04*
