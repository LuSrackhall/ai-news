/**
 * ValidateOutput Task — policyEngine.execute('validate')
 */

import { ExecutionResult } from '../runtime/result.mjs'

export class ValidateOutput {
  constructor(ctx) { this.ctx = ctx }

  async execute(ctx) {
    const curatedEvents = ctx._curatedEvents || []

    const validation = ctx.scope.policyEngine.execute('validate', {
      article: { content: ctx._articleContent },
      script: { content: ctx._scriptContent },
      curatedEvents,
      articleMarkdown: ctx._articleMarkdown || '',
      scriptMarkdown: ctx._scriptMarkdown || '',
    })

    ctx._validation = validation

    return ExecutionResult.ok({}, {
      content_passed: validation.contentPassed,
      consistency: validation.consistency,
      validation_passed: validation.validation_passed,
    })
  }
}
