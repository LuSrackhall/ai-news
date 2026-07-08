## Context

4 人评估团队审计确认：`output/` vs `output/production/ai/` 路径分裂导致验收脚本不可用、Agent 按需文档执行时报 `ENOENT`、同一个脚本内不同函数走不同目录。

## Goals / Non-Goals

**Goals:**
- 统一所有脚本路径为 `output/production/ai/<date>/`
- 修复 validate-output.mjs 的 article.md 路径 bug

**Non-Goals:**
- 不强求 import output-config.mjs
- 不引入 test 目录
- 不涉及 Agent 语义验收

## Decisions

### D1: 直接改路径字符串，不强制 output-config
输出-config.mjs 保留为参考配置，但不强制所有脚本 import。

### D2: validate-output.mjs 修复优先级最高
三处硬编码 article.md 路径改为使用 OUTPUT_DIR 常量。

### D3: SKILL.md Steps 5/6/8 同步修改
与 Steps 2-4 保持一致，全部使用 production 目录。

### D4: 保留旧数据
旧 output/ 目录历史数据不做搬迁。

## Risks / Trade-offs

| 风险 | 缓解 |
|-|-|
| 未来新增文件继续硬编码 | 添加 CI grep 检查 |
| 旧路径数据验收无法覆盖 | `OUTPUT_DIR=output` 临时切换 |
