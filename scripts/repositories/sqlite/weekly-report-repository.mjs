/**
 * SQLite Weekly Report Repository — 写模型
 * 写入 weekly_reports 表
 */

export function createSqliteWeeklyReportRepository(db) {
  const insertStmt = db.prepare(`
    INSERT INTO weekly_reports (id, week_start, week_end, cluster_count, event_count, article_chars, script_chars, created_at, metadata)
    VALUES (@id, @week_start, @week_end, @cluster_count, @event_count, @article_chars, @script_chars, @created_at, @metadata)
  `)

  return {
    store(report) {
      return insertStmt.run({
        id: report.id,
        week_start: report.week_start,
        week_end: report.week_end,
        cluster_count: report.cluster_count || 0,
        event_count: report.event_count || 0,
        article_chars: report.article_chars || 0,
        script_chars: report.script_chars || 0,
        created_at: report.created_at || new Date().toISOString(),
        metadata: typeof report.metadata === 'string'
          ? report.metadata
          : JSON.stringify(report.metadata || {}),
      }).changes
    },
  }
}
