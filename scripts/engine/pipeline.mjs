/**
 * PipelineRunner — 调度所有 Phase 的生命周期
 * 统一补 duration、捕获异常、fatal 时落盘 execution
 */

import { PhaseResult } from './phase-result.mjs'
import { buildRun } from './execution.mjs'

export function createPipeline(phases) {
  return {
    async run(ctx) {
      const results = []
      const startedAt = Date.now()

      for (const phase of phases) {
        // shouldSkip
        if (phase.shouldSkip) {
          const skip = await phase.shouldSkip(ctx)
          if (skip) {
            ctx.services.logger.info(`⏭ 跳过: ${phase.name}`)
            results.push({ phase: phase.name, ...PhaseResult.skipped() })
            continue
          }
        }

        ctx.runtime.workflow.phase(phase.name)
        ctx.services.logger.info(`▶ ${phase.name}`)

        // before
        try { await phase.before?.(ctx) } catch (e) {
          ctx.services.logger.warn(`before(${phase.name}) 异常: ${e.message}`)
        }

        // run
        const phaseStartedAt = Date.now()
        let result
        try {
          result = await phase.run(ctx)
        } catch (err) {
          ctx.services.logger.error(`${phase.name} 异常: ${err.message}`)
          result = PhaseResult.fatal(err.message)
        }
        result.duration = ctx.environment.clock.elapsed(phaseStartedAt)

        // after
        try { await phase.after?.(ctx, result) } catch (e) {
          ctx.services.logger.warn(`after(${phase.name}) 异常: ${e.message}`)
        }

        results.push({ phase: phase.name, ...result })

        // fatal → 落盘当前 execution 并终止
        if (result.status === 'fatal') {
          ctx.services.logger.error(`Fatal @ ${phase.name}: ${result.reason}`)
          const run = buildRun(ctx, results, startedAt, 'fatal')
          ctx.stores.execution.save(run)
          return { status: 'fatal', phase: phase.name, reason: result.reason, manifest: run.manifest }
        }
      }

      const run = buildRun(ctx, results, startedAt, 'success')
      ctx.stores.execution.save(run)
      return { status: 'success', manifest: run.manifest }
    },
  }
}
