import type { OfflineMapPoint } from '@/api/mapOffline';
import type { TravelCoords } from '@/types/types';
import { deleteRegion, type OfflineRegion } from '@/utils/mapTileCache';
import { offlineCatalog } from './offlineCatalog';

export interface OfflineMapRegionSnapshot {
  region: OfflineRegion;
  points: OfflineMapPoint[];
}

const keyForRegion = (regionId: string): string => `map-region:${regionId}`;

export async function saveMapRegionOffline(
  region: OfflineRegion,
  points: OfflineMapPoint[],
  etag: string | null,
) {
  return offlineCatalog.save({
    key: keyForRegion(region.id),
    type: 'map-region',
    sourceId: region.id,
    authScope: 'public',
    route: `/map?offlineRegion=${encodeURIComponent(region.id)}`,
    title: region.name,
    pinned: true,
    includePhotos: false,
    snapshot: { region, points } satisfies OfflineMapRegionSnapshot,
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
  await deleteRegion(regionId);
  await offlineCatalog.remove(keyForRegion(regionId));
}
