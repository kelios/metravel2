import type { OfflineAssetStore } from './offlineAssets.types';

const offlineAssets: OfflineAssetStore = {
  async download(_packageKey, _sources, options = {}) {
    if (options.signal?.aborted) {
      throw Object.assign(new Error('OFFLINE_OPERATION_ABORTED'), { name: 'AbortError' });
    }
    return [];
  },
  async remove() {},
};

export default offlineAssets;
