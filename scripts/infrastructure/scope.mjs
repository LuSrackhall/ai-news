/**
 * buildScope — 组装所有业务依赖
 *
 * 支持两种模式：
 * - buildScope(host, date) → JSON 文件存储（v4.1 兼容）
 * - buildScope(null, null, { db }) → SQLite 存储（v4.2）
 */

import { createJsonFileStorage } from '../storage/json-file-storage.mjs'
import { createEventRepository } from '../repositories/event-repository.mjs'
import { createAssetRepository } from '../repositories/asset-repository.mjs'
import { createArtifactRepository } from '../repositories/artifact-repository.mjs'
import { createEventReadModel } from '../read-models/event-read-model.mjs'
import { createAssetReadModel } from '../read-models/asset-read-model.mjs'
import { createArtifactReadModel } from '../read-models/artifact-read-model.mjs'
import { createSqliteEventRepository } from '../repositories/sqlite/event-repository.mjs'
import { createSqliteClusterRepository } from '../repositories/sqlite/cluster-repository.mjs'
import { createSqliteFeedbackRepository } from '../repositories/sqlite/feedback-repository.mjs'
import { createSqliteWeeklyReportRepository } from '../repositories/sqlite/weekly-report-repository.mjs'
import { createSqliteEventReadModel } from '../read-models/sqlite/event-read-model.mjs'
import { createSqliteClusterReadModel } from '../read-models/sqlite/cluster-read-model.mjs'
import { buildPolicyEngine } from './policies.mjs'

export function buildScope(host, date, opts = {}) {
  // SQLite 模式
  if (opts.db) {
    return {
      events: {
        repository: createSqliteEventRepository(opts.db),
        clusterRepository: createSqliteClusterRepository(opts.db),
        feedbackRepository: createSqliteFeedbackRepository(opts.db),
        weeklyReportRepository: createSqliteWeeklyReportRepository(opts.db),
        readModel: createSqliteEventReadModel(opts.db),
        clusterReadModel: createSqliteClusterReadModel(opts.db),
      },
      assets: null,     // v4.2 Ingestion 不需要独立 asset store
      artifacts: null,   // v4.2 Editorial 直接用 ctx._articleContent
      policyEngine: buildPolicyEngine(),
      inference: null,   // 由调用方填充
    }
  }

  // JSON 文件模式（v4.1 兼容）
  const storage = createJsonFileStorage(date)
  storage.write('_meta', { date })

  const eventRepo = createEventRepository(storage)
  const assetRepo = createAssetRepository(storage)
  const artifactRepo = createArtifactRepository(storage)
  const eventRead = createEventReadModel(storage)
  const assetRead = createAssetReadModel(storage)
  const artifactRead = createArtifactReadModel(storage)

  return {
    events: { repository: eventRepo, readModel: eventRead },
    assets: { repository: assetRepo, readModel: assetRead },
    artifacts: { repository: artifactRepo, readModel: artifactRead },
    policyEngine: buildPolicyEngine(),
    inference: null,
    unitOfWork: {
      begin() {},
      commit() {},
      rollback() {},
    },
  }
}
