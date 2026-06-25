/**
 * IngestionPipeline — 持续运行的采集管道声明
 */

export const ingestionPipeline = {
  name: 'ingestion',
  steps: [
    { taskId: 'CollectAssets', name: '采集', retry: 2 },
    { taskId: 'NormalizeAssets', name: '归一化' },
    { taskId: 'VerifyAssets', name: '验证' },
    { taskId: 'ExtractEntities', name: '实体提取' },
    { taskId: 'ScoreEvents', name: '评分' },
    { taskId: 'DedupEvents', name: '去重' },
    { taskId: 'StoreEvents', name: '入库' },
  ],
}
