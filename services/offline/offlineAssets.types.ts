import type { OfflineStoredAsset } from './types';

export interface OfflineAssetSource {
  id: string;
  url: string;
}

export interface OfflineAssetStore {
  download(packageKey: string, sources: OfflineAssetSource[]): Promise<OfflineStoredAsset[]>;
  remove(assets: OfflineStoredAsset[]): Promise<void>;
}
