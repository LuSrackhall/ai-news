/**
 * ArtifactReadModel — 读模型（load/loadMarkdown）
 */

export function createArtifactReadModel(storage) {
  return {
    load(type) {
      const all = storage.read('artifacts') || {}
      return all[type] || null
    },
    loadMarkdown(type) {
      const artifact = this.load(type)
      return artifact?.rendered?.markdown || null
    },
  }
}
