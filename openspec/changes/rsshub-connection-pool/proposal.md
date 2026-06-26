## Why

当前 25 个 RSS 源中，Anthropic、DeepSeek、机器之心等重要源没有原生 RSS。约 20 个源需 RSSHub 中转，但公共实例不稳定，需要连接池 + 熔断机制保证可用性。

## What Changes

- 新增 `RSSHUB_INSTANCES` 池化 URL 列表（不区分自建/公共）
- 新增 `RsshubPool` 连接池模块（熔断器 + 指数退避 + 健康持久化）
- `collect-rss.mjs` 的 fetchFeed 中对 rsshub 源走连接池拼接 URL（~8 行改动）
- `config.mjs` 新增约 20 个 RSSHub 中转源条目（Anthropic、DeepSeek、机器之心等）
- RSSHub 源采集间隔从 200ms 加大到 1-2 秒

## Capabilities

### New Capabilities
- `rsshub-pool`: RSSHub 公共实例连接池，含熔断器（三态：CLOSED/OPEN/HALF-OPEN）、指数退避、健康状态持久化到 `data/rsshub-health.json`

### Modified Capabilities
（无现有 spec 需要修改）

## Impact

- `scripts/infrastructure/rsshub-pool.mjs` — 新增，~150 行
- `scripts/config.mjs` — 新增 RSSHUB_INSTANCES + 20 个 RSSHub 源
- `scripts/collect-rss.mjs` — fetchFeed 改 ~8 行 + RSSHub 间隔调整
- `scripts/test-rsshub-pool.mjs` — 新增单元测试
- 无外部依赖引入（纯 Node.js fetch + fs）
