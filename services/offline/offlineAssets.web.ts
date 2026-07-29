import type { OfflineAssetStore } from './offlineAssets.types';

const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result ?? ''));
  reader.onerror = () => reject(reader.error ?? new Error('OFFLINE_ASSET_READ_FAILED'));
  reader.readAsDataURL(blob);
});

const offlineAssets: OfflineAssetStore = {
  async download(_packageKey, sources, options = {}) {
    const assets = [];
    options.onProgress?.(0, sources.length);
    for (let index = 0; index < sources.length; index += 1) {
      const source = sources[index];
      const response = await fetch(source.url, {
        credentials: 'omit',
        signal: options.signal,
      });
      if (!response.ok) throw new Error('OFFLINE_ASSET_DOWNLOAD_FAILED');
      const blob = await response.blob();
      assets.push({ id: source.id, uri: await blobToDataUrl(blob), bytes: blob.size });
      options.onProgress?.(index + 1, sources.length);
    }
    return assets;
  },
  async remove() {},
};

export default offlineAssets;
