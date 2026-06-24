/**
 * ValidateOutput Task — 校验
 * readModel.load → policyEngine.execute('validate') → 返回结果
 */

import { ExecutionResult } from '../runtime/result.mjs'

export class ValidateOutput {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const events = ctx.scope.events.readModel.load()
    const curatedEvents = events.filter(e => e.curation)
    const articleArtifact = ctx.scope.artifacts.readModel.load('article')
    const scriptArtifact = ctx.scope.artifacts.readModel.load('script')

    const validation = ctx.scope.policyEngine.execute('validate', {
      article: articleArtifact,
      script: scriptArtifact,
      curatedEvents,
      articleMarkdown: articleArtifact?.rendered?.markdown || '',
      scriptMarkdown: scriptArtifact?.rendered?.markdown || '',
    })

    return ExecutionResult.ok({}, {
      content_passed: validation.contentPassed,
      consistency: validation.consistency,
      validation_passed: validation.validation_passed,
    })
  }
}
