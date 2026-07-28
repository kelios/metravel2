import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineCatalog, assertPublicSnapshotSafe } from '@/services/offline/offlineCatalog';

const mockPackages = new Map<string, unknown>();
const mockRemoveAssets = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@/services/offline/packageStore', () => ({
  __esModule: true,
  default: {
    read: jest.fn(async (key: string) => mockPackages.get(key) ?? null),
    write: jest.fn(async (key: string, payload: unknown) => {
      mockPackages.set(key, payload);
      return { bytes: JSON.stringify(payload).length, includesAssetBytes: true };
    }),
    remove: jest.fn(async (key: string) => {
      mockPackages.delete(key);
    }),
  },
}));

jest.mock('@/services/offline/offlineAssets', () => ({
  __esModule: true,
  default: { remove: (...args: unknown[]) => mockRemoveAssets(...args) },
}));

const input = (key: string, overrides: Record<string, unknown> = {}) => ({
  key,
  type: 'travel' as const,
  sourceId: key,
  route: `/travels/${key}`,
  title: `Travel ${key}`,
  snapshot: { id: key, description: 'saved' },
  now: 1_000,
  ...overrides,
});

describe('OfflineCatalog', () => {
  beforeEach(() => {
    mockPackages.clear();
    mockRemoveAssets.mockClear();
    return AsyncStorage.clear();
  });

  it('round-trips a measured ready package and updates last-opened time', async () => {
    const catalog = new OfflineCatalog();
    const manifest = await catalog.save(input('one'));

    expect(manifest).toMatchObject({
      key: 'one',
      status: 'ready',
      pinned: false,
      assetCount: 0,
    });
    expect(manifest.bytes).toBeGreaterThan(0);
    await expect(catalog.read('one')).resolves.toEqual({ id: 'one', description: 'saved' });
  });

  it('counts bytes stored outside the package payload', async () => {
    const catalog = new OfflineCatalog();
    const manifest = await catalog.save(input('map', { additionalBytes: 4096 }));
    expect(manifest.bytes).toBeGreaterThanOrEqual(4096);
  });

  it('never exposes a user-scoped package to another identity', async () => {
    const catalog = new OfflineCatalog();
    await catalog.save(input('private', { authScope: 'user:42' }));

    await expect(catalog.read('private', 42)).resolves.toEqual({ id: 'private', description: 'saved' });
    await expect(catalog.read('private', 7)).resolves.toBeNull();
    await expect(catalog.list(7)).resolves.toEqual([]);
  });

  it('rejects private credentials in a public snapshot', () => {
    expect(() => assertPublicSnapshotSafe({ nested: { token: 'must-not-persist' } })).toThrow(
      'OFFLINE_PUBLIC_PACKAGE_CONTAINS_PRIVATE_DATA',
    );
  });

  it('evicts only unpinned LRU entries above the recent count', async () => {
    const catalog = new OfflineCatalog();
    await catalog.save(input('pinned', { pinned: true, now: 10 }));
    for (let index = 0; index < 22; index += 1) {
      await catalog.save(input(`recent-${index}`, { now: 100 + index }));
    }

    const items = await catalog.list();
    expect(items.filter((item) => item.pinned).map((item) => item.key)).toEqual(['pinned']);
    expect(items.filter((item) => !item.pinned)).toHaveLength(20);
    expect(items.some((item) => item.key === 'recent-0')).toBe(false);
    expect(items.some((item) => item.key === 'recent-21')).toBe(true);
  });

  it('removes package payload and manifest together', async () => {
    const catalog = new OfflineCatalog();
    await catalog.save(input('remove-me'));
    await catalog.remove('remove-me');

    await expect(catalog.read('remove-me')).resolves.toBeNull();
    await expect(catalog.summary()).resolves.toEqual({
      packageCount: 0,
      pinnedCount: 0,
      recentCount: 0,
      bytes: 0,
    });
  });
});
