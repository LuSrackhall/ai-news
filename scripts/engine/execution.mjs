/**
 * Execution 模型 — PipelineRun 构建器
 */

import { createHash } from 'node:crypto'
import {
  PIPELINE_VERSION, PROMPT_VERSION, SCHEMA_VERSION,
} from '../config.mjs'
import { RENDERER_VERSION } from '../render-article.mjs'

let runCounter = 0

/**
 * 从 PhaseResult[] 构建 PipelineRun 对象
 */
export function buildRun(ctx, results, startedAt, status) {
  const now = new Date().toISOString()
  const date = ctx.environment.date
  const id = `run-${date.replace(/-/g, '')}-${String(++runCounter).padStart(3, '0')}`

  // 聚合 manifest 视图
  const manifest = {
    date,
    pipeline_version: PIPELINE_VERSION,
    prompt_version: PROMPT_VERSION,
    renderer_version: RENDERER_VERSION,
    schema_version: SCHEMA_VERSION,
    llm_model: 'claude-sonnet',
    pipeline: {},
    quality: {},
    duration_total_s: Math.round((Date.now() - startedAt) / 1000),
  }

  for (const r of results) {
    if (r.metrics) {
      manifest.pipeline[r.phase] = { ...r.metrics, duration_s: r.duration ? Math.round(r.duration / 1000) : undefined }
    }
  }

  return {
    id,
    date,
    pipelineVersion: PIPELINE_VERSION,
    promptVersion: PROMPT_VERSION,
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: now,
    status,
    results,
    manifest,
  }
}
