/**
 * AggregateByCluster Task — 按 cluster_id 聚合事件
 * 无 cluster_id 的事件按时间窗口聚合
 */

import { ExecutionResult } from '../runtime/result.mjs'

export class AggregateByCluster {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const events = ctx._weekEvents || []
    const clusterReadModel = ctx.scope.events.clusterReadModel

    // 按 cluster_id 分组
    const clusterMap = new Map()
    const unclustered = []

    for (const event of events) {
      if (event.clusterId) {
        if (!clusterMap.has(event.clusterId)) {
          clusterMap.set(event.clusterId, [])
        }
        clusterMap.get(event.clusterId).push(event)
      } else {
        unclustered.push(event)
      }
    }

    // 构建聚合结果
    const clusters = []

    for (const [clusterId, clusterEvents] of clusterMap) {
      // 尝试从 DB 获取 Cluster 元数据
      const clusterMeta = clusterReadModel?.findById(clusterId) || null

      // 按评分排序，取最高分事件标题
      const sorted = [...clusterEvents].sort((a, b) =>
        (b.rank?.totalScore || 0) - (a.rank?.totalScore || 0)
      )

      clusters.push({
        id: clusterId,
        title: clusterMeta?.title || sorted[0]?.title || 'Untitled',
        importance: clusterMeta?.importance || 'medium',
        events: sorted,
        eventCount: clusterEvents.length,
        topScore: sorted[0]?.rank?.totalScore || 0,
      })
    }

    // 未聚类事件：按天分组作为 fallback
    if (unclustered.length > 0) {
      const dayMap = new Map()
      for (const event of unclustered) {
        const day = (event.effectiveAt || '').slice(0, 10) || 'unknown'
        if (!dayMap.has(day)) dayMap.set(day, [])
        dayMap.get(day).push(event)
      }

      for (const [day, dayEvents] of dayMap) {
        const sorted = [...dayEvents].sort((a, b) =>
          (b.rank?.totalScore || 0) - (a.rank?.totalScore || 0)
        )
        clusters.push({
          id: `unclustered-${day}`,
          title: sorted[0]?.title || `${day} 热点`,
          importance: 'low',
          events: sorted,
          eventCount: dayEvents.length,
          topScore: sorted[0]?.rank?.totalScore || 0,
        })
      }
    }

    // 按 topScore 排序 clusters
    clusters.sort((a, b) => b.topScore - a.topScore)

    ctx._clusters = clusters

    return ExecutionResult.ok(
      { clusters: clusters.length, unclustered: unclustered.length },
      {
        total_clusters: clusters.length,
        clustered_events: events.length - unclustered.length,
        unclustered_events: unclustered.length,
      }
    )
  }
}
