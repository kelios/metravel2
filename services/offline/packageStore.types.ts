import type { OfflinePackagePayload } from './types';

export interface OfflinePackageWriteResult {
  bytes: number;
  includesAssetBytes: boolean;
}

export interface OfflinePackageStore {
  read<T>(key: string): Promise<OfflinePackagePayload<T> | null>;
  write<T>(key: string, payload: OfflinePackagePayload<T>): Promise<OfflinePackageWriteResult>;
  remove(key: string): Promise<void>;
}
