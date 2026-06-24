# AI 日报 — 测试指南（v4.1 Execution Runtime）

## 自动化测试

```bash
# Runtime 框架测试（13 项）
node scripts/test-runtime.mjs
```

覆盖范围：
- ExecutionResult 构建
- ExecutionGraph 序列化
- ExecutionSession 记录
- TaskRegistry resolve 全新实例
- GraphCompiler 编译 + 校验
- PolicyEngine execute（ranking/dedup）
- Repository store + ReadModel load

## 人工审核检查点

每次日报生成后，检查 `output/<date>/execution.json`：

| 检查项 | 期望值 |
|--------|--------|
| status | `success` |
| ScoreEvents metrics.auto | >= 5 |
| DedupEvents metrics.removed | < 10 |
| CurateEvents metrics.selected | 8-15 |
| GenerateArticle status | `ok` |
| GenerateScript status | `ok` |
| RenderArtifacts metrics.article_chars | > 2000 |
| ValidateOutput metrics.validation_passed | true |

## 端到端验证

```bash
# 运行日报
/ai-ribao-daily --date=<date>

# 检查产出
cat output/<date>/article.md    # 文章结构完整、内容准确
cat output/<date>/script.md     # 口播稿时长 180-300s
cat output/<date>/execution.json # 所有 Task status=ok
```
