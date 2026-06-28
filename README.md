# AI 日报 (ai-ribao)

基于 **Dual Runtime v4.4** 的 AI 内容智能平台。每日从 89 个信源采集、评分、去重、聚类、选题，生成日报文章和播客脚本。

## 架构

```
Ingestion（纯 Node.js，无需 LLM）
  collect → normalize → verify → extract → cluster → score → dedup → store
  输出 → SQLite (data/events.db)

Editorial（Agent 驱动，/daily）
  Agent 读取 SQLite → 选题 → 写文章 → 写播客脚本 → 渲染/校验/归档
  输出 → output/<date>/

Weekly（纯 Node.js + 可选 LLM，/weekly）
  加载 7 天事件 → 按 Cluster 聚合 → 生成文章 → 渲染 → 归档
  输出 → output/weekly/<start>_<end>/
```

**Ingestion 是纯 Node.js，不需要 LLM。Editorial 是 Skill，Agent 自己就是 LLM。**

### 核心设计原则

- **Runtime 边界不变** — 只新增 Task + Pipeline，不修改 Runtime 核心
- **Task 负责数据组装，Policy 只做纯计算** — Policy 不碰 IO、不碰 Repository
- **Repository（写）+ ReadModel（读）** — 纯 CQRS
- **ClusterPolicy 可替换** — 当前规则版，v4.5 可通过 scope DI 注入 LLM 版
- **RSSHub 连接池 + 熔断器** — 无原生 RSS 的源自动走池化实例

## 快速开始

```bash
# 1. 采集新闻（每天跑一次，或 cron 定时）
node scripts/run-ingestion.mjs

# 2. 生成日报（对 Agent 说 /daily）
#    Agent 读取 SQLite → 选题 → 写文章 → 写播客脚本 → 渲染 → 归档

# 3. 生成周报
node scripts/run-weekly.mjs
```

## 信源（33 个）

| 分类 | 数量 | 示例 |
|------|------|------|
| Tier 1 官方一手 | 10 | OpenAI、Google DeepMind、Google AI Blog、Meta、HuggingFace、arXiv |
| Tier 2 权威媒体 | 14 | TechCrunch、The Verge、Ars Technica、TLDR AI、36氪、量子位 |
| Tier 3 社区 | 3 | Hacker News、LessWrong、Alignment Forum |
| RSSHub 中转 | 8 | Anthropic、DeepSeek、机器之心、虎嗅、晚点LatePost、Cursor |
| **RSSHub 连接池** | 5 个实例 | 自动熔断 + 指数退避 + 健康持久化 |

## 目录结构

```
scripts/
├── runtime/                        # 框架层（零业务知识）
│   ├── runtime.mjs                 # Runtime 执行引擎
│   ├── registry.mjs                # TaskRegistry
│   ├── compiler.mjs                # GraphCompiler
│   └── result.mjs                  # ExecutionResult
├── pipelines/
│   ├── ingestion.mjs               # Ingestion Pipeline 声明
│   └── weekly.mjs                  # Weekly Pipeline 声明
├── tasks-ingestion/                # Ingestion Tasks（8 个）
├── tasks-weekly/                   # Weekly Tasks（5 个）
├── domain/                         # 领域模型
│   ├── cluster.mjs                 # ClusterPolicy（三重匹配）
│   └── hash.mjs                    # 哈希工具
├── repositories/sqlite/            # 写模型
├── read-models/sqlite/             # 读模型
├── policies/                       # 评分/渲染/校验策略
├── services/                       # InferenceService
├── infrastructure/
│   ├── database.mjs                # SQLite 建表
│   ├── scope.mjs                   # 依赖注入
│   ├── policies.mjs                # PolicyEngine
│   └── rsshub-pool.mjs             # RSSHub 连接池 + 熔断器
├── config.mjs                      # 信源/评分/权重/RSSHub 实例配置
├── collect-rss.mjs                 # RSS 采集脚本
├── run-ingestion.mjs               # Ingestion 入口
├── run-weekly.mjs                  # Weekly 入口
├── test-sqlite.mjs                 # SQLite 测试（21 项）
└── test-rsshub-pool.mjs            # RsshubPool 测试（10 项）
```

## 测试

```bash
node scripts/test-sqlite.mjs        # SQLite + 聚类 + 周报 + 反馈（21 项）
node scripts/test-rsshub-pool.mjs   # RSSHub 连接池（10 项）
```

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v4.4 | 2026-06-26 | Event 聚类 + 周报 + 反馈收集 + RSSHub 连接池 + RSS 源扩展至 33 个 |
| v4.2 | 2026-06-25 | Dual Runtime：Ingestion（纯代码）+ Editorial（Agent 驱动）+ SQLite |
| v4.1 | 2026-06-24 | Execution Runtime：Host/Task/PolicyEngine/Repository 七层架构 |
| v4.0 | 2026-06-23 | Pipeline Engine（已废弃） |
| v3 | 2026-06-22 | 8 阶段混合 Pipeline（已废弃） |
