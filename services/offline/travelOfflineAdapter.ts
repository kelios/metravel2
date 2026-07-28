import type { Travel } from '@/types/types';
import { offlineCatalog } from './offlineCatalog';
import { downloadAndRewriteOfflineAssets } from './offlineAssetHelpers';

const normalizeIdentifier = (value: string | number): string => String(value).trim();

export async function saveTravelOffline(
  travel: Travel,
  options: { pinned?: boolean; includePhotos?: boolean; routeParam?: string | number } = {},
) {
  const sourceId = travel.id ?? travel.slug ?? options.routeParam;
  if (sourceId == null || !travel.name) return null;
  const routeIdentifier = travel.slug ?? options.routeParam ?? travel.id;
  const key = `travel:${normalizeIdentifier(sourceId)}`;
  const packaged = options.includePhotos
    ? await downloadAndRewriteOfflineAssets(key, travel, 12)
    : { snapshot: travel, assets: [] };

  try {
    return await offlineCatalog.save({
      key,
      type: 'travel',
      sourceId,
      authScope: 'public',
      route: `/travels/${encodeURIComponent(normalizeIdentifier(routeIdentifier ?? sourceId))}`,
      title: travel.name,
      pinned: options.pinned,
      includePhotos: options.includePhotos,
      snapshot: packaged.snapshot,
      assets: packaged.assets,
    });
  } catch (error) {
    if (packaged.assets.length) {
      const { default: offlineAssets } = await import('./offlineAssets');
      await offlineAssets.remove(packaged.assets);
    }
    throw error;
  }
}

export async function readTravelOffline(
  identifier: string | number,
): Promise<Travel | null> {
  const normalized = normalizeIdentifier(identifier);
  const items = await offlineCatalog.list();
  const match = items.find((item) => {
    if (item.type !== 'travel' || item.status !== 'ready') return false;
    if (item.sourceId === normalized || item.key === `travel:${normalized}`) return true;
    const routeIdentifier = decodeURIComponent(item.route.split('/').filter(Boolean).pop() ?? '');
    return routeIdentifier === normalized;
  });
  return match ? offlineCatalog.read<Travel>(match.key) : null;
}
