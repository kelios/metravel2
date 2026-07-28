import type { OfflineAssetStore } from './offlineAssets.types';

const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result ?? ''));
  reader.onerror = () => reject(reader.error ?? new Error('OFFLINE_ASSET_READ_FAILED'));
  reader.readAsDataURL(blob);
});

const offlineAssets: OfflineAssetStore = {
  async download(_packageKey, sources) {
    const assets = [];
    for (const source of sources) {
      const response = await fetch(source.url, { credentials: 'omit' });
      if (!response.ok) throw new Error('OFFLINE_ASSET_DOWNLOAD_FAILED');
      const blob = await response.blob();
      assets.push({ id: source.id, uri: await blobToDataUrl(blob), bytes: blob.size });
    }
    return assets;
  },
  async remove() {},
};

export default offlineAssets;
