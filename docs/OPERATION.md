# AI 日报 操作手册（v4.1 Execution Runtime）

## 日常操作

### 生成日报

```bash
/ai-ribao-daily                     # 今日
/ai-ribao-daily --date=2026-06-24   # 指定日期
```

### 检查产出

```bash
# 执行状态
cat output/<date>/execution.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['status'])"

# 查看文章
cat output/<date>/article.md

# 查看口播稿
cat output/<date>/script.md
```

### 信源管理

编辑 `scripts/config.mjs` 的 `RSS_SOURCES` 数组。新增信源无需修改其他文件。

### 评分调整

编辑 `scripts/config.mjs` 的 `SCORING` / `ENTITY_WEIGHTS` / `EVENT_TYPE_WEIGHTS`。

### Prompt 调整

编辑 `prompts/v1/` 下的模板文件。新增示例到 `prompts/examples/`。

## 故障排查

| 问题 | 排查方式 |
|------|---------|
| 采集条目为空 | 检查 `data/source-health.json` 的 failStreak |
| LLM 生成失败 | 检查 `execution.json` 中 GenerateArticle/GenerateScript 的 errors |
| 校验未通过 | 检查 `execution.json` 中 ValidateOutput 的 metrics |
| 去重过度 | 检查 DedupEvents 的 metrics.removed 详情 |

## 运行测试

```bash
node scripts/test-runtime.mjs
```
