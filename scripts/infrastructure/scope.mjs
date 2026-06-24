/**
 * buildScope — 组装所有业务依赖
 */

import { createJsonFileStorage } from '../storage/json-file-storage.mjs'
import { createEventRepository } from '../repositories/event-repository.mjs'
import { createAssetRepository } from '../repositories/asset-repository.mjs'
import { createArtifactRepository } from '../repositories/artifact-repository.mjs'
import { createEventReadModel } from '../read-models/event-read-model.mjs'
import { createAssetReadModel } from '../read-models/asset-read-model.mjs'
import { createArtifactReadModel } from '../read-models/artifact-read-model.mjs'
import { buildPolicyEngine } from './policies.mjs'

export function buildScope(host, date) {
  const storage = createJsonFileStorage(date)
  // 存储 date 到 _meta 供 readModel.history 使用
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
    inference: null, // v4.1 任务组 5 填充
    unitOfWork: {
      begin() {},
      commit() { /* JSON 下 = 已经直接写入 */ },
      rollback() { /* v4.2+ 实现 */ },
    },
  }
}
