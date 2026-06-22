## Context

AI 日报系统（ai-ribao）当前是 Agent Workflow 架构——`ai-ribao-daily.js` 用 6 个 agent() 调用串联整个流程，每个阶段的执行和文件写入都依赖 LLM。这导致 6 个已确认问题（详见 brainstorm-spec.md Context 节）。

本次重构将系统从 Agent Workflow 改为 Pipeline 驱动架构，其中 6 个阶段由 Node.js 代码确定性执行，仅 2 个阶段（选题、生成）使用 LLM。

**约束：**
- 工作树路径：`.claude/worktrees/ai-ribao-pipeline-v3`
- 必须保持向后兼容的输出目录结构（`output/<date>/article.md`, `script.md`, `manifest.json`）
- 不引入付费第三方依赖（零 npm 依赖设计，复用已有的自研 XML 解析器）
- LLM 调用通过 Claude Code Workflow 的 agent() 接口

## Goals / Non-Goals

详见 brainstorm-spec.md Goals/Non-Goals 节。核心补充：

**额外目标：**
- 零 npm 依赖（Node.js 内置模块即可）
- 所有代码模块可独立测试（纯函数 + 明确的输入输出）

**额外 Non-Goals：**
- 不做自动定时触发（保持手动或 CI 触发）
- 不做多语言输出（仅中文）

## Decisions

### Pipeline 引擎设计

使用 Claude Code Workflow 的 phase()/agent()/parallel() 原语编排 8 个阶段。pipeline 引擎代码在 `ai-ribao-daily.js`（重写），每个阶段的业务逻辑抽取为独立模块。

```
ai-ribao-daily.js        ← Workflow 编排（phase/agent/log 调用）
scripts/
  collect-rss.mjs        ← Phase 1: RSS 采集（已有，增强）
  verify-urls.mjs         ← Phase 2: URL 验证（新增）
  score.mjs              ← Phase 3: 评分模块（新增）
  dedup.mjs              ← Phase 3: 去重模块（新增）
  render-article.mjs     ← Phase 6: 文章渲染（新增）
  render-script.mjs      ← Phase 6: 脚本渲染（新增）
  validate-output.mjs    ← Phase 7: 校验模块（新增）
  config.mjs             ← 全局配置（重构）
```

**选择理由：** 模块化设计使每个阶段可独立测试和调试。Workflow 编排层只负责阶段顺序、错误处理和 agent() 调用，不含业务逻辑。

### LLM 交互设计

- Phase 4（选题）：agent() 读取 candidates.json，返回 curated.json（JSON Schema 约束）
- Phase 5a（文章生成）：agent() 读取 curated.json，返回 article.json
- Phase 5b（脚本生成）：agent() 读取 curated.json + article.json，返回 script.json
- Phase 5 串行：先 5a 再 5b，保证脚本能引用文章内容
- 所有 agent() 调用使用 schema 参数强制 JSON 输出

### 数据流设计

```
Phase 1: collect-rss.mjs → output/<date>/raw/all-raw.json
Phase 2: verify-urls.mjs(all-raw.json) → valid_raw.json
Phase 3: score.mjs(valid_raw.json) + dedup.mjs → candidates.json
Phase 4: agent(candidates.json) → output/<date>/curated.json
Phase 5a: agent(curated.json) → article.json (内存)
Phase 5b: agent(curated.json + article.json) → script.json (内存)
Phase 6: render-article(article.json) + render-script(script.json) → 内存
Phase 7: validate(article.md, script.md, curated.json) → 校验结果
Phase 8: writeFileSync → output/<date>/article.md, script.md, manifest.json
         updateIndex → output/index.json
```

### 错误处理策略

详见 brainstorm-spec.md D2 节。补充实现细节：

- Fatal：Workflow 返回 `{ status: 'fatal', reason: '...', phase: '...' }`
- Recoverable：记录到 manifest.pipeline.{phase}.errors 数组，继续执行
- LLM 重试：agent() 返回 null 时重试一次（Workflow 内置支持）
- Schema 重试：JSON 解析失败时尝试截取 `{...}` 再解析，仍失败则重试 agent()

## Risks / Trade-offs

详见 brainstorm-spec.md Risks/Trade-offs 节。补充实现风险：

| 风险 | 缓解 |
|------|------|
| agent() 的 schema 参数可能不总是强制 JSON 输出 | 后处理做 JSON.parse 兜底 + `{...}` 截取 |
| Phase 5 串行增加总耗时约 50s | 可接受（总流程 ~120s），稳定性优先 |
| 评分模块的实体/事件列表需要人工维护 | config.mjs 集中管理，每季度 review |

## Open Questions

1. arXiv 48h 时间窗口是否需要对所有学术源生效，还是仅 arXiv？
2. WebSearch 补充查询是否在 Phase 1 与 RSS 并行执行，还是作为独立的 Phase 1b？
3. Renderer 的 Formatter 规则（标点、引号等）是否需要可配置化？

这三个问题可在实施阶段根据实际情况决定。
