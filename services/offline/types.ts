export type OfflineContentType = 'travel' | 'article' | 'quest' | 'map-region';

export type OfflineAuthScope = 'public' | `user:${string}`;

export type OfflinePackageStatus = 'downloading' | 'ready' | 'failed';

export interface OfflineStoredAsset {
  id: string;
  uri: string;
  bytes: number;
}

export interface OfflinePackagePayload<T = unknown> {
  schemaVersion: 1;
  snapshot: T;
  assets: OfflineStoredAsset[];
}

export interface OfflinePackageManifest {
  schemaVersion: 1;
  key: string;
  type: OfflineContentType;
  sourceId: string;
  authScope: OfflineAuthScope;
  route: string;
  title: string;
  status: OfflinePackageStatus;
  pinned: boolean;
  includePhotos: boolean;
  savedAt: number;
  updatedAt: number | null;
  lastOpenedAt: number;
  etag: string | null;
  bytes: number;
  assetCount: number;
}

export interface SaveOfflinePackageInput<T = unknown> {
  key: string;
  type: OfflineContentType;
  sourceId: string | number;
  authScope?: OfflineAuthScope;
  route: string;
  title: string;
  pinned?: boolean;
  includePhotos?: boolean;
  snapshot: T;
  assets?: OfflineStoredAsset[];
  etag?: string | null;
  /** Bytes stored by a domain outside packageStore (for example native map tiles). */
  additionalBytes?: number;
  now?: number;
}

export interface OfflineStorageSummary {
  packageCount: number;
  pinnedCount: number;
  recentCount: number;
  bytes: number;
}
