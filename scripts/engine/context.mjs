/**
 * PipelineContext — DI Container
 * 5 个 root namespace: runtime / environment / services / stores / domain
 */

import { createLoggerService } from '../services/logger.mjs'
import { createPromptService } from '../services/prompt.mjs'
import { createAgentService } from '../services/agent.mjs'
import { WORKFLOW_CONFIG, RSS_SOURCES, ENTITY_WEIGHTS, EVENT_TYPE_WEIGHTS, ACADEMIC_SIGNALS, SCORING } from '../config.mjs'
import { createAssetStore } from '../stores/assets.mjs'
import { createEventStore } from '../stores/events.mjs'
import { createArtifactStore } from '../stores/artifacts.mjs'
import { createExecutionStore } from '../stores/execution.mjs'
import { createRankingDomain } from '../domain/ranking.mjs'
import { createDedupDomain } from '../domain/dedup.mjs'
import { createCurationDomain } from '../domain/curation.mjs'
import { createGenerateDomain } from '../domain/generate.mjs'
import { createRenderDomain } from '../domain/render.mjs'
import { createValidateDomain } from '../domain/validate.mjs'

export function createPipelineContext({ date, workflowRuntime }) {
  // ── Environment（只读）──
  const environment = {
    date,
    workspace: '.',
    config: {
      ...WORKFLOW_CONFIG,
      sources: RSS_SOURCES,
      entityWeights: ENTITY_WEIGHTS,
      eventTypeWeights: EVENT_TYPE_WEIGHTS,
      academicSignals: ACADEMIC_SIGNALS,
      scoring: SCORING,
      pipelineVersion: 'v4',
      promptVersion: 'v1',
      rendererVersion: 'v1',
      schemaVersion: 'v1',
    },
    clock: {
      now: () => new Date().toISOString(),
      elapsed: (startMs) => Date.now() - startMs,
    },
  }

  // ── Runtime（Claude Code 原语注入）──
  const runtime = {
    workflow: { phase: workflowRuntime.phase },
    llm: { agent: workflowRuntime.agent },
    log: workflowRuntime.log,
  }

  // ── Services（横切关注点）──
  const services = {
    logger: createLoggerService(runtime),
    prompt: createPromptService(environment),
    agent: createAgentService(runtime),
    metrics: createMetricsService(),
    cache: null, // v4.1+
  }

  // ── Stores ──
  const stores = {
    assets: createAssetStore(environment),
    events: createEventStore(environment),
    artifacts: createArtifactStore(environment),
    execution: createExecutionStore(environment),
  }

  // ── Domain ──
  const ctx = { stores, services, environment }
  const domain = {
    ranking: createRankingDomain(ctx),
    dedup: createDedupDomain(ctx),
    curation: createCurationDomain(ctx),
    generate: createGenerateDomain(ctx),
    render: createRenderDomain(ctx),
    validate: createValidateDomain(ctx),
  }

  return { runtime, environment, services, stores, domain }
}

function createMetricsService() {
  const records = []
  return {
    record(phase, key, value) {
      records.push({ phase, key, value, at: new Date().toISOString() })
    },
    snapshot() { return [...records] },
  }
}
