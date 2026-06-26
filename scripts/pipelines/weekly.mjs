/**
 * WeeklyPipeline — 周报生成管道声明
 */

export const weeklyPipeline = {
  name: 'weekly',
  steps: [
    { taskId: 'LoadWeekEvents', name: '加载周事件' },
    { taskId: 'AggregateByCluster', name: '聚类聚合' },
    { taskId: 'GenerateWeeklyArticle', name: '生成文章' },
    { taskId: 'RenderWeekly', name: '渲染' },
    { taskId: 'ArchiveWeekly', name: '归档' },
  ],
}
