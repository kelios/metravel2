import type { OfflineAssetStore } from './offlineAssets.types';

const offlineAssets: OfflineAssetStore = {
  async download() {
    return [];
  },
  async remove() {},
};

export default offlineAssets;
