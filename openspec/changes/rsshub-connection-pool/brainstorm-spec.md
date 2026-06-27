## Context

当前 25 个 RSS 源中，Anthropic、DeepSeek、机器之心等没有原生 RSS。test.md 记录了 64+ 个源，约 20 个需 RSSHub 中转。公共实例不稳定，需要连接池 + 熔断机制。

## Goals / Non-Goals

**Goals：**
- 接入需要 RSSHub 中转的源（Anthropic、DeepSeek、机器之心等）
- 实例不可用时自动跳过，快速找到能用的
- 用户添加新源和新实例都很简单（加一行 URL）

**Non-Goals：**
- 区分自建/公共实例（池子里就是一堆 URL）
- 自动发现新实例
- 代理/IP 轮换

## Decisions

### D1: 池子 = URL 列表，不区分来源

```js
RSSHUB_INSTANCES = [
  'https://rsshub.app',
  'https://rsshub.rssforever.com',
  'https://rsshub.pseudoyu.com',
  'https://rss.fatpandac.com',
  'https://rsshub-instance.zeabur.app',
]
```

自建实例 = 在数组最前面加一行 URL。零代码改动。

### D2: 熔断器 — 快速跳过不可用实例

三态：CLOSED → 连续失败 3 次 → OPEN（熔断）→ 冷却超时 → HALF-OPEN（试探）→ 成功 → CLOSED

冷却时间：`min(10min × 2^failures, 2h)`

意义：不是"全部失败时的兜底"，而是跳过当前不可用的实例，避免在一个挂掉的实例上等 15 秒超时。

### D3: 健康状态持久化到 data/rsshub-health.json

collect-rss.mjs 是独立进程（execSync），内存态每次重启丢失。持久化到文件与现有 source-health.json 风格一致。

### D4: 源配置格式

```js
// 直接 RSS（不变）
{ id: 'openai', url: 'https://openai.com/news/rss.xml' }

// RSSHub 中转（新增 rsshub 字段）
{ id: 'anthropic', name: 'Anthropic', rsshub: '/anthropic/news', tier: 1, ... }
```

rsshub 字段写路由路径，不含实例域名。fetchFeed 中通过连接池拼接完整 URL。

### D5: 最小侵入集成

collect-rss.mjs 的 fetchFeed 只改约 8 行：

```js
let fetchUrl = source.url
if (source.rsshub) {
  const instance = pool.getInstance()
  if (!instance) return { status: 'error', error: 'All RSSHub instances down', items: [] }
  fetchUrl = instance + source.rsshub
}
```

不新建函数，不改 collect-assets.mjs。

### D6: RSSHub 源采集间隔 1-2 秒

现有源间隔 200ms。RSSHub 源改为 1000-2000ms，避免对同一实例突发流量触发限流。

### D7: 区分网络失败 vs 内容失败

- 网络失败（超时、5xx）→ 计入熔断
- 内容失败（返回非 XML、解析错误）→ 不计入熔断，只记录源级失败

## Risks

| 风险 | 缓解 |
|------|------|
| 公共实例随时下线 | 5 个实例轮转 + 熔断跳过 |
| 官方实例限流严格 | 间隔 1-2 秒 + 多实例分散 |
| 不同实例版本不一致 | 选社区活跃维护的实例 |
| RSSHub 路由返回非标准 XML | 与直接 RSS 用同一套 XML 解析 + 错误处理 |

## 新增/修改文件

| 文件 | 改动 |
|------|------|
| `scripts/infrastructure/rsshub-pool.mjs` | **新增**，~150 行，连接池 + 熔断器 + 持久化 |
| `scripts/config.mjs` | 新增 `RSSHUB_INSTANCES` + RSSHub 源条目 |
| `scripts/collect-rss.mjs` | fetchFeed 改 ~8 行 + 导入 pool + RSSHub 间隔调整 |
| `scripts/test-rsshub-pool.mjs` | **新增**，单元测试（mock fetch） |
