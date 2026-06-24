/**
 * buildPolicyEngine — 注册所有 Policy
 */

import { RankingPolicy } from '../policies/ranking-policy.mjs'
import { DedupPolicy } from '../policies/dedup-policy.mjs'
import { ValidationPolicy } from '../policies/validation-policy.mjs'
import { RenderPolicy } from '../policies/render-policy.mjs'
import { AuthorityRule } from '../rules/authority-rule.mjs'
import { TimelinessRule } from '../rules/timeliness-rule.mjs'
import { EntityWeightRule } from '../rules/entity-weight-rule.mjs'
import { EventTypeRule } from '../rules/event-type-rule.mjs'
import { QuantitativeRule } from '../rules/quantitative-rule.mjs'
import { AcademicRule } from '../rules/academic-rule.mjs'
import { TitleSimilarityRule } from '../rules/title-similarity-rule.mjs'
import { EventFingerprintRule } from '../rules/event-fingerprint-rule.mjs'

export function buildPolicyEngine() {
  const policies = new Map()

  policies.set('ranking', new RankingPolicy([
    new AuthorityRule(),
    new TimelinessRule(),
    new EntityWeightRule(),
    new EventTypeRule(),
    new QuantitativeRule(),
    new AcademicRule(),
  ]))

  policies.set('dedup', new DedupPolicy(
    new TitleSimilarityRule(),
    new EventFingerprintRule(),
  ))

  policies.set('validate', new ValidationPolicy())
  policies.set('render', new RenderPolicy())

  return {
    execute(name, data) {
      const policy = policies.get(name)
      if (!policy) throw new Error(`Unknown policy: ${name}`)
      return policy.execute(data)
    },
    get(name) {
      return policies.get(name)
    },
  }
}
