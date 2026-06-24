/**
 * AssetReadModel — 读模型（load）
 */

export function createAssetReadModel(storage) {
  return {
    load() { return storage.read('assets') || [] },
  }
}
