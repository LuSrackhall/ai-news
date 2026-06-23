/**
 * AI 日报 - Pipeline v4（Content Intelligence Runtime）
 *
 * workflow 只做三件事：
 *   1. 构建 PipelineContext
 *   2. 调用 pipeline.run(ctx)
 *   3. 返回结果
 *
 * Phase 调度由 PipelineRunner 管理，workflow 不知道有几个 Phase。
 */

import { createPipelineContext } from './scripts/engine/context.mjs'
import { createPipeline } from './scripts/engine/pipeline.mjs'

// ── Phase 注册 ──
import { CollectPhase } from './scripts/phases/collect.mjs'
import { VerifyPhase } from './scripts/phases/verify.mjs'
import { ScorePhase } from './scripts/phases/score.mjs'
import { DedupPhase } from './scripts/phases/dedup.mjs'
import { CuratePhase } from './scripts/phases/curate.mjs'
import { GenerateArticlePhase } from './scripts/phases/generate-article.mjs'
import { GenerateScriptPhase } from './scripts/phases/generate-script.mjs'
import { RenderPhase } from './scripts/phases/render.mjs'
import { ValidatePhase } from './scripts/phases/validate.mjs'
import { ArchivePhase } from './scripts/phases/archive.mjs'

export const meta = {
  name: 'ai-ribao-daily-v4',
  description: 'AI 日报 - Pipeline v4（Content Intelligence Runtime）',
  phases: [{ title: '执行', detail: 'Pipeline 自动调度所有 Phase' }],
}

const ctx = createPipelineContext({
  date: (args && args.date) || new Date().toISOString().slice(0, 10),
  workflowRuntime: { phase, agent, log },
})

const pipeline = createPipeline([
  new CollectPhase(),
  new VerifyPhase(),
  new ScorePhase(),
  new DedupPhase(),
  new CuratePhase(),
  new GenerateArticlePhase(),
  new GenerateScriptPhase(),
  new RenderPhase(),
  new ValidatePhase(),
  new ArchivePhase(),
])

const result = await pipeline.run(ctx)
return result
