/**
 * EditorialPipeline — 定时运行的内容生产管道声明
 */

export const editorialPipeline = {
  name: 'editorial',
  steps: [
    { taskId: 'SelectEditorialWindow', name: '选择窗口' },
    { taskId: 'CurateEvents', name: '选题', retry: 1 },
    { taskId: 'GenerateArticle', name: '文章生成', retry: 1 },
    { taskId: 'GenerateScript', name: '播客脚本生成', retry: 1 },
    { taskId: 'RenderArtifacts', name: '渲染' },
    { taskId: 'ValidateOutput', name: '校验' },
    { taskId: 'ArchiveOutput', name: '归档' },
  ],
}
