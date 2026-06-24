/**
 * AssetRepository — 写模型（store/remove）
 */

export function createAssetRepository(storage) {
  return {
    store(assets) { storage.write('assets', assets) },
    remove(ids) {
      const assets = storage.read('assets') || []
      const idSet = new Set(ids)
      storage.write('assets', assets.filter(a => !idSet.has(a.id)))
    },
  }
}
