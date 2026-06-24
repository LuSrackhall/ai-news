/**
 * ArtifactRepository — 写模型（store/remove）
 */

export function createArtifactRepository(storage) {
  return {
    store(type, artifact) {
      const all = storage.read('artifacts') || {}
      all[type] = artifact
      storage.write('artifacts', all)
    },
    remove(type) {
      const all = storage.read('artifacts') || {}
      delete all[type]
      storage.write('artifacts', all)
    },
  }
}
