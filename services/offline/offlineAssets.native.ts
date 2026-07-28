import * as FileSystem from 'expo-file-system/legacy';
import type { OfflineAssetStore } from './offlineAssets.types';

const ROOT = `${FileSystem.documentDirectory ?? ''}offline-content/v1/assets/`;

const extensionForUrl = (url: string): string => {
  const pathname = url.split('?')[0].split('#')[0];
  const match = pathname.match(/\.(jpe?g|png|webp|gif|avif)$/i);
  return match ? `.${match[1].toLowerCase()}` : '.img';
};

const offlineAssets: OfflineAssetStore = {
  async download(packageKey, sources) {
    if (!sources.length) return [];
    const directory = `${ROOT}${encodeURIComponent(packageKey)}/${Date.now()}-${Math.random().toString(36).slice(2)}/`;
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

    try {
      const assets = [];
      for (let index = 0; index < sources.length; index += 1) {
        const source = sources[index];
        const destination = `${directory}${index}${extensionForUrl(source.url)}`;
        const result = await FileSystem.downloadAsync(source.url, destination);
        if (!result || result.status < 200 || result.status >= 300) {
          throw new Error('OFFLINE_ASSET_DOWNLOAD_FAILED');
        }
        const info = await FileSystem.getInfoAsync(destination);
        if (!info.exists || info.isDirectory) throw new Error('OFFLINE_ASSET_WRITE_FAILED');
        assets.push({
          id: source.id,
          uri: destination,
          bytes: typeof info.size === 'number' ? info.size : 0,
        });
      }
      return assets;
    } catch (error) {
      await FileSystem.deleteAsync(directory, { idempotent: true }).catch(() => undefined);
      throw error;
    }
  },

  async remove(assets) {
    const ownedAssets = assets
      .filter((asset) => asset.uri.startsWith(FileSystem.documentDirectory ?? 'file://'))
    await Promise.all(ownedAssets
      .map((asset) => FileSystem.deleteAsync(asset.uri, { idempotent: true }).catch(() => undefined)));
    const directories = new Set(ownedAssets.map((asset) => asset.uri.replace(/[^/]+$/, '')));
    await Promise.all(Array.from(directories, (directory) =>
      FileSystem.deleteAsync(directory, { idempotent: true }).catch(() => undefined)));
  },
};

export default offlineAssets;
