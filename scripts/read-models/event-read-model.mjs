/**
 * EventReadModel — 读模型（load/history）
 */

export function createEventReadModel(storage) {
  return {
    load() { return storage.read('events') || [] },

    history(days) {
      const events = []
      const baseDate = new Date(storage.read('_meta')?.date || new Date().toISOString().slice(0, 10) + 'T00:00:00Z')

      for (let i = 0; i < days; i++) {
        const d = new Date(baseDate)
        d.setUTCDate(d.getUTCDate() - i)
        const dateStr = d.toISOString().slice(0, 10)
        const dayEvents = storage.readDay('events', dateStr)
        if (dayEvents) events.push(...(Array.isArray(dayEvents) ? dayEvents : []))
      }
      return events
    },
  }
}
