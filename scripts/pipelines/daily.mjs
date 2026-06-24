/**
 * DailyPipeline — AI 日报 Pipeline 声明（纯声明式）
 */

export const dailyPipeline = {
  name: 'daily',
  steps: [
    { taskId: 'CollectAssets', name: '采集', retry: 2 },
    { taskId: 'VerifyAssets', name: '验证' },
    { taskId: 'ScoreEvents', name: '评分' },
    { taskId: 'DedupEvents', name: '去重' },
    { taskId: 'CurateEvents', name: '选题' },
    { taskId: 'GenerateArticle', name: '文章生成', retry: 1 },
    { taskId: 'GenerateScript', name: '口播稿生成', retry: 1 },
    { taskId: 'RenderArtifacts', name: '渲染' },
    { taskId: 'ValidateOutput', name: '校验' },
    { taskId: 'ArchiveOutput', name: '归档' },
  ],
}
