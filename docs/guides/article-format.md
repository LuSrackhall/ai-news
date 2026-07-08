# 日报文章格式规范

Agent 生成 `article.json` 和渲染 `article.md` 时必须遵守以下格式。

## article.json 格式约束

| 字段 | 约束 | 说明 |
|------|------|------|
| `summary_items` | 3 ~ 6 条 | **禁止携带 `source` 字段**（速览区不显示来源） |
| `deep_items` | 1 ~ 3 条 | 必须含 `content`（>=200字）+ `sources` 数组（不含 `source` 单数） |
| `important_items` | 3 ~ 10 条 | 每条必须含 `source: { name, url }` 对象 |
| `brief_items` | 3 ~ 10 条 | 每条必须含 `sources: [{ name, url }]` 数组 |
| `editorial` | 必须 | 三段式：`observation` / `evidence` / `judgment`，每段 >= 30 字 |
| `hook` | 必须 | 一段引人注目的开场白，概括当天核心叙事 |

## article.md 结构（自动化渲染）

```
# AI 日报 — <date>

> <hook>

## 速览
（纯标题+摘要，无来源链接）
### <title>
<summary>

## 深度
### <title>
<content>
*来源：[name](url)、[name](url)*

## 重要动态
### <title>
<summary>
*来源：[name](url)*

## 快讯
**<title>**
<summary>
*来源：[name](url)*

---

**编辑观察：** <observation>

**证据：** <evidence>

**判断：** <judgment>

*数据来源：<sources> | AI 辅助生成，经审核*
```

## 渲染命令

```bash
node scripts/render-article.mjs <date>
```

生成文章后必须运行渲染命令，确保 `article.md` 格式一致。
