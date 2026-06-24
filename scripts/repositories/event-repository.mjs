/**
 * EventRepository — 写模型（store/remove）
 */

export function createEventRepository(storage) {
  return {
    store(events) { storage.write('events', events) },
    remove(ids) {
      const events = storage.read('events') || []
      const idSet = new Set(ids)
      storage.write('events', events.filter(e => !idSet.has(e.id)))
    },
  }
}
