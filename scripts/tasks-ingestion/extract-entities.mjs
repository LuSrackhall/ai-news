/**
 * ExtractEntities Task — 规则提取实体（regex + 实体表）
 * 写入 event_entities 关系表
 */

import { ExecutionResult } from '../runtime/result.mjs'
import { ENTITY_WEIGHTS } from '../config.mjs'

export class ExtractEntities {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const assets = ctx._assets || []
    let extracted = 0

    for (const asset of assets) {
      const text = `${asset.title || ''} ${asset.summary || ''}`.toLowerCase()
      const entities = []

      for (const tier of Object.values(ENTITY_WEIGHTS)) {
        if (!tier.entities) continue
        for (const entity of tier.entities) {
          if (text.includes(entity.toLowerCase())) {
            entities.push(entity)
          }
        }
      }

      asset.entities = [...new Set(entities)]
      if (entities.length > 0) extracted++
    }

    ctx._assets = assets

    return ExecutionResult.ok(
      { extracted },
      { total: assets.length, with_entities: extracted }
    )
  }
}
