/**
 * TaskRegistry — 字符串 ID → Task 实例
 * resolve(id, ctx) 每次返回全新实例，不复用、不缓存
 */

export class TaskRegistry {
  constructor() {
    this.map = new Map()
  }

  register(id, TaskClass) {
    this.map.set(id, TaskClass)
  }

  resolve(id, ctx) {
    const TaskClass = this.map.get(id)
    if (!TaskClass) throw new Error(`Unknown task: ${id}`)
    return new TaskClass(ctx)
  }

  has(id) {
    return this.map.has(id)
  }

  registerAll(entries) {
    for (const [id, TaskClass] of Object.entries(entries)) {
      this.map.set(id, TaskClass)
    }
  }
}
