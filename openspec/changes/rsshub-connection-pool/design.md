## Context

collect-rss.mjs 的 fetchFeed 函数用 `fetch(source.url)` 直接请求 RSS 源。需要 RSSHub 中转的源（Anthropic、DeepSeek 等）没有原生 RSS URL，需要通过公共实例的路由（如 `https://rsshub.app/anthropic/news`）访问。公共实例不稳定，需要连接池 + 熔断机制。

## Goals / Non-Goals

**Goals：**
- 通过连接池自动选择可用的 RSSHub 实例
- 实例不可用时快速跳过（熔断器），避免等待超时
- 健康状态跨进程持久化（cron 模式下每次是新进程）

**Non-Goals：**
- 区分自建/公共实例（池子里就是 URL 列表）
- 自动发现新实例
- 负载均衡（按顺序尝试即可）

## Decisions

### D1: RsshubPool 类 — 独立模块

`scripts/infrastructure/rsshub-pool.mjs`，~150 行。接口：

```
class RsshubPool {
  constructor(instances: string[])
  getInstance(): string | null      // 返回可用实例 URL，全部熔断返回 null
  reportSuccess(url: string): void  // fetchFeed 成功时调用
  reportFailure(url: string): void  // fetchFeed 网络失败时调用
}
```

collect-rss.mjs 只需导入并调用 `getInstance()`，不感知内部逻辑。

### D2: 熔断器三态模型

```
CLOSED（正常）
  → 连续失败 3 次 → OPEN（熔断）

OPEN（熔断）
  → 冷却超时 → HALF-OPEN（试探）

HALF-OPEN（试探）
  → getInstance() 返回此实例做一次探测
  → 成功 → CLOSED
  → 失败 → 重新 OPEN，冷却时间翻倍
```

冷却时间：`min(10min × 2^failures, 2h)`（首次 10min → 20min → 40min → ... → 2h 上限）

### D3: 健康持久化

写入 `data/rsshub-health.json`，格式：

```json
{
  "https://rsshub.app": {
    "status": "closed",
    "consecutiveFailures": 0,
    "cooldownUntil": null,
    "lastSuccess": "2026-06-26T08:00:00Z",
    "lastFailure": null
  }
}
```

启动时读取，请求结束后写入。与 source-health.json 风格一致。

### D4: fetchFeed 最小侵入改造

在 `fetchFeed` 函数的 fetch 调用前插入 ~8 行：

```js
let fetchUrl = source.url
if (source.rsshub) {
  const instance = pool.getInstance()
  if (!instance) {
    return { source: source.id, status: 'error', error: 'All RSSHub instances down', items: [] }
  }
  fetchUrl = instance + source.rsshub
}
```

成功/失败时调用 `pool.reportSuccess(instance)` / `pool.reportFailure(instance)`。

### D5: RSSHub 源间隔 1-2 秒

现有源间隔 200ms（`i * 200`）。RSSHub 源单独标记，在 Promise.allSettled 中用 `i * 1500` 延迟。

### D6: 网络失败 vs 内容失败

- 网络失败（超时、HTTP 5xx）→ `pool.reportFailure()`，计入熔断
- 内容失败（返回非 XML、解析错误）→ 不计入熔断，只走源级错误处理

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 公共实例限流 | 多实例分散 + 1-2 秒间隔 |
| 持久化文件损坏 | JSON.parse 失败时重置为空对象 |
| 不同实例返回不同内容 | 选社区活跃维护的实例 |
