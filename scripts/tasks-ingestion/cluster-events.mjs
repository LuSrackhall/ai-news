/**
 * ClusterEvents Task — 事件聚类
 *
 * 在 Ingestion 阶段 ExtractEntities 之后执行。
 * 对每个新事件，与已有 Cluster 比较（ClusterPolicy 三重匹配），
 * 归入已有 Cluster 或创建新 Cluster。
 */

import { randomUUID } from 'node:crypto'
import { ExecutionResult } from '../runtime/result.mjs'
import { ClusterPolicy } from '../domain/cluster.mjs'

export class ClusterEvents {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const assets = ctx._assets || []
    // B5: 支持通过 scope 注入策略，方便 v4.5 LLM 替换
    const clusterPolicy = ctx.scope?.clusterPolicy || new ClusterPolicy()

    // A1: 用 ReadModel 读取已有 Cluster（CQRS 隔离，写模型无 findAll）
    const clusterReadModel = ctx.scope?.events?.clusterReadModel
    const existingClusters = clusterReadModel ? clusterReadModel.findAll() : []

    let clustered = 0
    let newClusters = 0

    for (const asset of assets) {
      const eventInput = {
        entities: asset.entities || [],
        eventType: asset.eventType || asset.event_type || 'general',
        keywords: asset.keywords || [],
        title: asset.title || '',
        weekKey: clusterPolicy.weekKey(asset.effective_at || asset.published_at || new Date()),
      }

      // 尝试匹配已有 Cluster
      let matchedCluster = null
      for (const cluster of existingClusters) {
        const clusterMeta = typeof cluster.metadata === 'string'
          ? JSON.parse(cluster.metadata || '{}')
          : (cluster.metadata || {})

        const clusterInput = {
          entities: typeof cluster.entity_keys === 'string'
            ? JSON.parse(cluster.entity_keys || '[]')
            : (cluster.entity_keys || []),
          eventType: clusterMeta.eventType || '',
          keywords: typeof cluster.topic_keys === 'string'
            ? JSON.parse(cluster.topic_keys || '[]')
            : (cluster.topic_keys || []),
          title: cluster.title || '',
          weekKey: clusterMeta.weekKey || '',
        }

        const result = clusterPolicy.match(eventInput, clusterInput)
        if (result.match) {
          matchedCluster = cluster
          break
        }
      }

      if (matchedCluster) {
        // 归入已有 Cluster
        asset.cluster_id = matchedCluster.id
        clustered++

        // 更新 Cluster 元数据（内存中）
        const entities = typeof matchedCluster.entity_keys === 'string'
          ? JSON.parse(matchedCluster.entity_keys || '[]')
          : (matchedCluster.entity_keys || [])
        const mergedEntities = [...new Set([...entities, ...asset.entities])]

        matchedCluster.entity_keys = JSON.stringify(mergedEntities)
        matchedCluster.event_count = (matchedCluster.event_count || 0) + 1
        matchedCluster.last_updated = new Date().toISOString()

        // 更新标题（如果新事件评分更高）
        if (asset.rank_total != null && asset.rank_total > (matchedCluster._topScore || 0)) {
          matchedCluster.title = asset.title
          matchedCluster._topScore = asset.rank_total
        }
      } else {
        // 创建新 Cluster
        const clusterId = `cluster-${randomUUID().slice(0, 8)}`
        const newCluster = {
          id: clusterId,
          title: asset.title,
          type: 'auto',
          importance: 'medium',
          event_count: 1,
          entity_keys: JSON.stringify(asset.entities || []),
          topic_keys: JSON.stringify(asset.keywords || []),
          first_seen: new Date().toISOString(),
          last_updated: new Date().toISOString(),
          metadata: JSON.stringify({
            eventType: eventInput.eventType,
            weekKey: eventInput.weekKey,
          }),
          _topScore: asset.rank_total || 0,
        }

        existingClusters.push(newCluster)
        asset.cluster_id = clusterId
        newClusters++
      }
    }

    // 将更新后的 clusters 写回供后续 StoreEvents 使用
    ctx._clusters = existingClusters
    ctx._assets = assets

    return ExecutionResult.ok(
      { clustered, newClusters },
      {
        total: assets.length,
        clustered,
        new_clusters: newClusters,
        total_clusters: existingClusters.length,
      }
    )
  }
}
