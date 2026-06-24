/**
 * PipelineSet — 多 Pipeline 管理
 */

import { dailyPipeline } from './daily.mjs'

export const pipelines = {
  daily: dailyPipeline,
  // weekly: weeklyPipeline,    // v4.5
  // research: researchPipeline, // v4.5
}
