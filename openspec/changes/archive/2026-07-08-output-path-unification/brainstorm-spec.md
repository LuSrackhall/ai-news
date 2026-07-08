# Output Path Unification — 路径统一变更

> 设计文档 — 2026-07-08

---

## Context

4 人评估团队（工程、质量架构、依赖分析、质疑者）审计发现：当前代码库中存在至少 **3 种不同的输出路径策略同时在运行**，且同一个脚本内（validate-output.mjs）存在互相矛盾的路径解析。

具体问题：
- `scripts/tasks-editorial/archive-output.mjs` 使用 `join('.', 'output', date)`（扁平旧路径）
- `scripts/validate-output.mjs` 的 JSON 读取用 OUTPUT_DIR，但 article.md 检查硬编码 `output/<date>/`
- `.claude/skills/ai-daily/skill.md` Steps 2-4 写 `output/production/ai/<date>/`，Steps 5-8 写 `output/<date>/`
- `scripts/tasks/score-events.mjs` 硬编码 `join('.', output, date, 'raw')`
- `scripts/tasks-weekly/archive-weekly.mjs` 硬编码

评估结论：路径不统一是当前产出质量控制的**最大阻塞项**。

## Goals / Non-Goals

**Goals:**
- 所有脚本和 SKILL.md 统一使用 `output/production/ai/<date>/` 作为 AI 日报产出基路径
- 修复 validate-output.mjs 的 article.md 路径硬编码 bug
- 保留 output-config.mjs 作为参考配置但不强制消费

**Non-Goals:**
- 不强求所有脚本 import output-config.mjs（单一领域下抽象层收益 < 成本）
- 不引入 test 目录机制
- 不涉及 Agent-driven 语义验收

## Decisions

### D1: 只改路径字符串，不引入 output-config 强制消费
直接修改各处硬编码路径，等出现第二个领域再做统一配置。

### D2: validate-output.mjs 的 article.md 路径改为使用 OUTPUT_DIR
三处硬编码 `output/${date}/article.md` → `OUTPUT_DIR/${date}/article.md`。

### D3: SKILL.md Steps 5/6/8 路径改为 production 目录
`join('.', 'output', date)` → `join('.', 'output/production/ai', date)`。

### D4: 保留旧 output/ 目录
12 天历史数据不做搬迁，新产出全部走新路径。

## Risks / Trade-offs

| 风险 | 缓解 |
|-|-|
| SKILL.md 变更与运行中 Agent 冲突 | 变更在 Agent 启动时加载，不影响已在运行的 Agent |
| 修复后旧路径数据无法被验收 | 用 `OUTPUT_DIR=output` 跑一次即可 |
| 未来新增文件可能继续硬编码 | 添加 CI grep 检查 |
