# Publication Domain

> Publication 是 Editorial Runtime 的消费方——它定义了一份出版物"编辑什么、怎么选、怎么写、怎么渲染"。

## 结构

Publication 是配置组合，不是代码分支：

```
Publication = EditorialStrategy + PromptSet + RenderPolicy

EditorialStrategy = LaneSet + RuleSet + MergeConfig
```

## 原则

- Publication 不直接调用 Runtime，Runtime 也不依赖具体 Publication
- 新增 Publication = 新增配置，不修改 Runtime 代码
- 多个 Publication 可以共享 Lane 和 Rule

## 示例

**AI 日报：**

```yaml
lanes: [research, industry, policy]
rules: [breaking, diversity, memory]
prompt: prompts/v1/curation.md
render: markdown
```

**国际 AI 摘要：**

```yaml
lanes: [industry, policy]
rules: [breaking, memory]
prompt: prompts/international/curation.md
render: markdown
```

---

*Version 1.0 · 2026-07-04*
