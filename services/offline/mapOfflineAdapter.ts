import { Platform } from 'react-native';
import type { OfflineMapPoint } from '@/api/mapOffline';
import type { TravelCoords } from '@/types/types';
import type { OfflineBBox, OfflineRegion } from '@/utils/mapTileCache';
import { offlineCatalog } from './offlineCatalog';

export interface OfflineMapRegionSnapshot {
  region: OfflineRegion;
  points: OfflineMapPoint[];
  plannedTiles: number;
  readyTiles: number;
  failedTiles: number;
  tileBytes: number;
  pointCount: number;
  etag: string | null;
}

const keyForRegion = (regionId: string): string => `map-region:${regionId}`;

export const buildMapRegionId = (
  bbox: OfflineBBox,
  minZ: number,
  maxZ: number,
): string => {
  const coordinates = [bbox.west, bbox.south, bbox.east, bbox.north]
    .map((value) => Number(value).toFixed(5))
    .join(':');
  let hash = 2166136261;
  for (let index = 0; index < coordinates.length; index += 1) {
    hash ^= coordinates.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `region-${minZ}-${maxZ}-${(hash >>> 0).toString(36)}`;
};

export async function saveMapRegionOffline(
  region: OfflineRegion,
  points: OfflineMapPoint[],
  etag: string | null,
) {
  const snapshot: OfflineMapRegionSnapshot = {
    region,
    points,
    plannedTiles: region.tileCount,
    readyTiles: region.tileCount,
    failedTiles: 0,
    tileBytes: region.bytes,
    pointCount: points.length,
    etag,
  };
  return offlineCatalog.save({
    key: keyForRegion(region.id),
    type: 'map-region',
    sourceId: region.id,
    authScope: 'public',
    route: `/map?offlineRegion=${encodeURIComponent(region.id)}`,
    title: region.name,
    pinned: true,
    includePhotos: false,
    snapshot,
    etag,
    additionalBytes: region.bytes,
  });
}

export async function readMapRegionOffline(regionId: string): Promise<OfflineMapRegionSnapshot | null> {
  return offlineCatalog.read<OfflineMapRegionSnapshot>(keyForRegion(regionId));
}

export async function readAllMapPointsOffline(): Promise<TravelCoords[]> {
  const packages = (await offlineCatalog.list()).filter(
    (item) => item.type === 'map-region' && item.status === 'ready',
  );
  const snapshots = await Promise.all(
    packages.map((item) => offlineCatalog.read<OfflineMapRegionSnapshot>(
      item.key,
      undefined,
      { markOpened: false },
    )),
  );
  const seen = new Set<string>();
  const result: TravelCoords[] = [];

  snapshots.forEach((snapshot) => {
    snapshot?.points.forEach((point) => {
      const key = `${point.id}:${point.lat},${point.lng}`;
      if (seen.has(key)) return;
      seen.add(key);
      result.push({
        id: point.id,
        name: point.title,
        address: point.title,
        fullAddress: point.address,
        categoryName: point.categoryName,
        coord: `${point.lat},${point.lng}`,
        lat: String(point.lat),
        lng: String(point.lng),
        travelImageThumbUrl: point.thumb,
        imageUrl: point.thumb,
        urlTravel: point.urlTravel || (point.slug ? `/travels/${point.slug}` : ''),
        slug: point.slug,
      } as TravelCoords);
    });
  });
  return result;
}

export async function deleteMapRegionOffline(regionId: string): Promise<void> {
  if (Platform.OS !== 'web') {
    const { deleteRegion } = await import('@/utils/mapTileCache');
    await deleteRegion(regionId);
  }
  await offlineCatalog.remove(keyForRegion(regionId));
}
