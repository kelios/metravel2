import AsyncStorage from '@react-native-async-storage/async-storage';
import packageStore from './packageStore';
import offlineAssets from './offlineAssets';
import type {
  OfflineAuthScope,
  OfflinePackageManifest,
  OfflinePackagePayload,
  OfflineStorageSummary,
  SaveOfflinePackageInput,
} from './types';

const MANIFEST_KEY = 'offline-catalog:manifest:v1';
const MAX_RECENT_ITEMS = 20;
const MAX_RECENT_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_RECENT_BYTES = 100 * 1024 * 1024;
const SENSITIVE_PUBLIC_KEYS = /^(authorization|password|secret|token|access_token|refresh_token)$/i;

type CatalogListener = () => void;

const isValidManifest = (value: unknown): value is OfflinePackageManifest => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<OfflinePackageManifest>;
  return item.schemaVersion === 1
    && typeof item.key === 'string'
    && typeof item.sourceId === 'string'
    && typeof item.route === 'string'
    && typeof item.title === 'string'
    && ['travel', 'article', 'quest', 'map-region'].includes(String(item.type))
    && ['downloading', 'ready', 'failed'].includes(String(item.status));
};

const assertPublicSnapshotSafe = (value: unknown): void => {
  const pending: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  const visited = new Set<object>();

  while (pending.length) {
    const current = pending.pop();
    if (!current || current.depth > 20 || !current.value || typeof current.value !== 'object') continue;
    if (visited.has(current.value as object)) continue;
    visited.add(current.value as object);

    for (const [key, child] of Object.entries(current.value as Record<string, unknown>)) {
      if (SENSITIVE_PUBLIC_KEYS.test(key)) {
        throw new Error('OFFLINE_PUBLIC_PACKAGE_CONTAINS_PRIVATE_DATA');
      }
      pending.push({ value: child, depth: current.depth + 1 });
    }
  }
};

const isVisibleForIdentity = (
  authScope: OfflineAuthScope,
  currentUserId?: string | number | null,
): boolean => authScope === 'public' || authScope === `user:${String(currentUserId ?? '')}`;

class OfflineCatalog {
  private listeners = new Set<CatalogListener>();
  private operation = Promise.resolve();

  subscribe(listener: CatalogListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }

  private async readManifest(): Promise<OfflinePackageManifest[]> {
    try {
      const raw = await AsyncStorage.getItem(MANIFEST_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isValidManifest);
    } catch {
      return [];
    }
  }

  private async writeManifest(items: OfflinePackageManifest[]): Promise<void> {
    await AsyncStorage.setItem(MANIFEST_KEY, JSON.stringify(items));
    this.emit();
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.operation.then(operation, operation);
    this.operation = next.then(() => undefined, () => undefined);
    return next;
  }

  async list(currentUserId?: string | number | null): Promise<OfflinePackageManifest[]> {
    const items = await this.readManifest();
    return items
      .filter((item) => isVisibleForIdentity(item.authScope, currentUserId))
      .sort((left, right) => right.lastOpenedAt - left.lastOpenedAt);
  }

  async get(key: string, currentUserId?: string | number | null): Promise<OfflinePackageManifest | null> {
    const items = await this.readManifest();
    return items.find(
      (item) => item.key === key && isVisibleForIdentity(item.authScope, currentUserId),
    ) ?? null;
  }

  async read<T>(
    key: string,
    currentUserId?: string | number | null,
    options: { markOpened?: boolean } = {},
  ): Promise<T | null> {
    const manifest = await this.get(key, currentUserId);
    if (!manifest || manifest.status !== 'ready') return null;
    const payload = await packageStore.read<T>(key);
    if (!payload) return null;
    if (options.markOpened !== false) void this.markOpened(key);
    return payload.snapshot;
  }

  async save<T>(input: SaveOfflinePackageInput<T>): Promise<OfflinePackageManifest> {
    return this.enqueue(async () => {
      const now = input.now ?? Date.now();
      const authScope = input.authScope ?? 'public';
      if (authScope === 'public') assertPublicSnapshotSafe(input.snapshot);

      const current = await this.readManifest();
      const previous = current.find((item) => item.key === input.key);
      const previousPayload = previous?.status === 'ready'
        ? await packageStore.read(input.key)
        : null;
      const downloading: OfflinePackageManifest = {
        schemaVersion: 1,
        key: input.key,
        type: input.type,
        sourceId: String(input.sourceId),
        authScope,
        route: input.route,
        title: input.title,
        status: 'downloading',
        pinned: input.pinned ?? previous?.pinned ?? false,
        includePhotos: input.includePhotos ?? false,
        savedAt: previous?.savedAt ?? now,
        updatedAt: previous ? now : null,
        lastOpenedAt: now,
        etag: input.etag ?? null,
        bytes: previous?.bytes ?? 0,
        assetCount: previous?.assetCount ?? 0,
      };

      if (!previous || previous.status !== 'ready') {
        await this.writeManifest([...current.filter((item) => item.key !== input.key), downloading]);
      }

      try {
        const payload: OfflinePackagePayload<T> = {
          schemaVersion: 1,
          snapshot: input.snapshot,
          assets: input.assets ?? [],
        };
        const stored = await packageStore.write(input.key, payload);
        const assetBytes = payload.assets.reduce((sum, asset) => sum + Math.max(0, asset.bytes), 0);
        const ready: OfflinePackageManifest = {
          ...downloading,
          status: 'ready',
          bytes: stored.bytes
            + (stored.includesAssetBytes ? 0 : assetBytes)
            + Math.max(0, input.additionalBytes ?? 0),
          assetCount: payload.assets.length,
        };
        const latest = await this.readManifest();
        await this.writeManifest([...latest.filter((item) => item.key !== input.key), ready]);
        if (previousPayload?.assets?.length) {
          await offlineAssets.remove(previousPayload.assets);
        }
        await this.evictRecent(now);
        return ready;
      } catch (error) {
        const latest = await this.readManifest();
        const failed: OfflinePackageManifest = { ...downloading, status: 'failed' };
        await this.writeManifest([
          ...latest.filter((item) => item.key !== input.key),
          ...(previous?.status === 'ready' ? [previous] : [failed]),
        ]);
        throw error;
      }
    });
  }

  async remove(key: string): Promise<void> {
    return this.enqueue(async () => {
      const payload = await packageStore.read(key);
      await packageStore.remove(key);
      if (payload?.assets?.length) await offlineAssets.remove(payload.assets);
      const current = await this.readManifest();
      await this.writeManifest(current.filter((item) => item.key !== key));
    });
  }

  async setPinned(key: string, pinned: boolean): Promise<void> {
    return this.enqueue(async () => {
      const current = await this.readManifest();
      await this.writeManifest(current.map((item) => (
        item.key === key ? { ...item, pinned } : item
      )));
      if (!pinned) await this.evictRecent(Date.now());
    });
  }

  async markOpened(key: string, now = Date.now()): Promise<void> {
    return this.enqueue(async () => {
      const current = await this.readManifest();
      if (!current.some((item) => item.key === key)) return;
      await this.writeManifest(current.map((item) => (
        item.key === key ? { ...item, lastOpenedAt: now } : item
      )));
    });
  }

  async summary(currentUserId?: string | number | null): Promise<OfflineStorageSummary> {
    const items = await this.list(currentUserId);
    return {
      packageCount: items.length,
      pinnedCount: items.filter((item) => item.pinned).length,
      recentCount: items.filter((item) => !item.pinned).length,
      bytes: items.reduce((sum, item) => sum + Math.max(0, item.bytes), 0),
    };
  }

  private async evictRecent(now: number): Promise<void> {
    const current = await this.readManifest();
    const pinned = current.filter((item) => item.pinned);
    const recent = current
      .filter((item) => !item.pinned)
      .sort((left, right) => right.lastOpenedAt - left.lastOpenedAt);
    const kept: OfflinePackageManifest[] = [];
    const removed: OfflinePackageManifest[] = [];
    let bytes = 0;

    recent.forEach((item) => {
      const expired = now - item.lastOpenedAt > MAX_RECENT_AGE_MS;
      const exceedsCount = kept.length >= MAX_RECENT_ITEMS;
      const exceedsBytes = bytes + item.bytes > MAX_RECENT_BYTES;
      if (expired || exceedsCount || exceedsBytes) {
        removed.push(item);
      } else {
        kept.push(item);
        bytes += item.bytes;
      }
    });

    if (!removed.length) return;
    await Promise.all(removed.map(async (item) => {
      const payload = await packageStore.read(item.key);
      await packageStore.remove(item.key);
      if (payload?.assets?.length) await offlineAssets.remove(payload.assets);
    }));
    await this.writeManifest([...pinned, ...kept]);
  }
}

export const offlineCatalog = new OfflineCatalog();
export { OfflineCatalog, assertPublicSnapshotSafe };
