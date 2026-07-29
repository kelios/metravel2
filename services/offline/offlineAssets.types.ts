import type { OfflineStoredAsset } from './types';

export interface OfflineAssetSource {
  id: string;
  url: string;
}

export interface OfflineAssetDownloadOptions {
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

export interface OfflineAssetStore {
  download(
    packageKey: string,
    sources: OfflineAssetSource[],
    options?: OfflineAssetDownloadOptions,
  ): Promise<OfflineStoredAsset[]>;
  remove(assets: OfflineStoredAsset[]): Promise<void>;
}
