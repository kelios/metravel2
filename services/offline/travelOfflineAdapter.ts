import type { Travel } from '@/types/types';
import { sanitizeRichText } from '@/utils/sanitizeRichText';
import { resolveMediaVariantUrl } from '@/utils/travelMediaVariants';
import { offlineCatalog } from './offlineCatalog';
import { offlineOperations } from './offlineOperations';
import {
  downloadAndRewriteOfflineAssetSources,
} from './offlineAssetHelpers';
import type { OfflineAssetSource } from './offlineAssets.types';

const normalizeIdentifier = (value: string | number): string => String(value).trim();

type PublicTravelAddress = {
  id?: number | string;
  name?: string;
  address?: string;
  description?: string;
  coord?: string;
  coords?: string;
  lat?: number | string;
  lng?: number | string;
  categoryName?: string;
  travelImageThumbUrl?: string;
  travelImageLandscapeUrl?: string | null;
  travelImageUrl?: string | null;
  urlTravel?: string;
  articleUrl?: string;
};

export type TravelOfflineSnapshot = Travel & {
  schemaVersion: 1;
  descriptionHtml: string;
  routePoints: Array<{
    id: string;
    lat?: number;
    lng?: number;
    address?: string;
    title?: string;
    imageUrl?: string;
  }>;
  sourceUpdatedAt?: string;
};

const stringValue = (value: unknown): string => typeof value === 'string' ? value : '';
const optionalString = (value: unknown): string | undefined => {
  const normalized = stringValue(value).trim();
  return normalized || undefined;
};

const toPublicAddress = (value: unknown): PublicTravelAddress | string | null => {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  return {
    ...(item.id != null ? { id: item.id as number | string } : {}),
    ...(optionalString(item.name) ? { name: optionalString(item.name) } : {}),
    ...(optionalString(item.address) ? { address: optionalString(item.address) } : {}),
    ...(optionalString(item.description) ? { description: optionalString(item.description) } : {}),
    ...(optionalString(item.coord) ? { coord: optionalString(item.coord) } : {}),
    ...(optionalString(item.coords) ? { coords: optionalString(item.coords) } : {}),
    ...(item.lat != null ? { lat: item.lat as number | string } : {}),
    ...(item.lng != null ? { lng: item.lng as number | string } : {}),
    ...(optionalString(item.categoryName) ? { categoryName: optionalString(item.categoryName) } : {}),
    ...(optionalString(item.travelImageThumbUrl) ? { travelImageThumbUrl: optionalString(item.travelImageThumbUrl) } : {}),
    ...(optionalString(item.travelImageLandscapeUrl) ? { travelImageLandscapeUrl: optionalString(item.travelImageLandscapeUrl) } : {}),
    ...(optionalString(item.travelImageUrl) ? { travelImageUrl: optionalString(item.travelImageUrl) } : {}),
    ...(optionalString(item.urlTravel) ? { urlTravel: optionalString(item.urlTravel) } : {}),
    ...(optionalString(item.articleUrl) ? { articleUrl: optionalString(item.articleUrl) } : {}),
  };
};

const parsePointCoordinates = (item: PublicTravelAddress): { lat?: number; lng?: number } => {
  const directLat = Number(item.lat);
  const directLng = Number(item.lng);
  if (Number.isFinite(directLat) && Number.isFinite(directLng)) {
    return { lat: directLat, lng: directLng };
  }
  const [lat, lng] = String(item.coord ?? item.coords ?? '').split(',').map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : {};
};

export function buildTravelOfflineSnapshot(travel: Travel): TravelOfflineSnapshot {
  const source = travel as Travel & Record<string, unknown>;
  const addresses = (Array.isArray(source.travelAddress) ? source.travelAddress : [])
    .map(toPublicAddress)
    .filter((item): item is PublicTravelAddress | string => item != null);
  const descriptionHtml = sanitizeRichText(
    source.rich_text?.description?.safe_html ?? source.description,
  );
  const routePoints: TravelOfflineSnapshot['routePoints'] = addresses.map((item, index) => {
    if (typeof item === 'string') {
      return { id: String(index), address: item };
    }
    const coordinates = parsePointCoordinates(item);
    return {
      id: String(item.id ?? index),
      ...coordinates,
      address: item.address ?? item.name,
      title: item.name ?? item.address,
      imageUrl: item.travelImageThumbUrl ?? item.travelImageLandscapeUrl ?? item.travelImageUrl ?? undefined,
    };
  });

  return {
    schemaVersion: 1,
    id: source.id,
    slug: source.slug,
    name: source.name,
    travel_image_thumb_url: source.travel_image_thumb_url,
    travel_image_thumb_small_url: source.travel_image_thumb_small_url,
    ...(source.travel_image_print_url ? { travel_image_print_url: source.travel_image_print_url } : {}),
    url: source.url,
    youtube_link: source.youtube_link,
    userName: source.userName,
    ...(source.authorRank ? { authorRank: source.authorRank } : {}),
    description: descriptionHtml,
    descriptionHtml,
    recommendation: sanitizeRichText(source.recommendation),
    plus: sanitizeRichText(source.plus),
    minus: sanitizeRichText(source.minus),
    ...(source.rich_text ? { rich_text: source.rich_text } : {}),
    cityName: source.cityName,
    countryName: source.countryName,
    countUnicIpView: source.countUnicIpView,
    ...(source.rating != null ? { rating: source.rating } : {}),
    ...(source.rating_count != null ? { rating_count: source.rating_count } : {}),
    ...(source.user_rating != null ? { user_rating: source.user_rating } : {}),
    ...(source.comment_count != null ? { comment_count: source.comment_count } : {}),
    ...(source.comments_count != null ? { comments_count: source.comments_count } : {}),
    ...(source.thread_id != null ? { thread_id: source.thread_id } : {}),
    ...(source.comment_thread_id != null ? { comment_thread_id: source.comment_thread_id } : {}),
    gallery: [],
    travelAddress: addresses as unknown as Travel['travelAddress'],
    ...(source.media ? { media: source.media } : {}),
    userIds: source.userIds,
    year: source.year,
    monthName: source.monthName,
    number_days: source.number_days,
    companions: Array.isArray(source.companions) ? source.companions : [],
    ...(Array.isArray(source.coordsMeTravel) ? { coordsMeTravel: source.coordsMeTravel } : {}),
    ...(source.mapImageUrl ? { mapImageUrl: source.mapImageUrl } : {}),
    countryCode: source.countryCode,
    ...(source.user ? {
      user: {
        id: source.user.id,
        name: source.user.name,
        ...(source.user.first_name ? { first_name: source.user.first_name } : {}),
        ...(source.user.last_name ? { last_name: source.user.last_name } : {}),
        ...(source.user.avatar ? { avatar: source.user.avatar } : {}),
      },
    } : {}),
    ...(source.created_at ? { created_at: source.created_at } : {}),
    ...(source.updated_at ? { updated_at: source.updated_at, sourceUpdatedAt: source.updated_at } : {}),
    ...(source.publish != null ? { publish: source.publish } : {}),
    ...(source.moderation != null ? { moderation: source.moderation } : {}),
    ...(source.publication_status ? { publication_status: source.publication_status } : {}),
    ...(source.engagementStats ? { engagementStats: source.engagementStats } : {}),
    routePoints,
  };
}

export const buildTravelAssetSources = (snapshot: TravelOfflineSnapshot): OfflineAssetSource[] => {
  const urls = [
    snapshot.travel_image_thumb_url,
    ...snapshot.routePoints.map((point) => point.imageUrl),
  ].filter((value): value is string => Boolean(value));
  return Array.from(new Set(urls))
    .map((id) => ({ id, url: resolveMediaVariantUrl(id) }))
    .filter((item): item is OfflineAssetSource => Boolean(item.url));
};

export async function saveTravelOffline(
  travel: Travel,
  options: {
    pinned?: boolean;
    includePhotos?: boolean;
    routeParam?: string | number;
    signal?: AbortSignal;
    onProgress?: (done: number, total: number) => void;
    trackOperation?: boolean;
  } = {},
) {
  const sourceId = travel.id ?? travel.slug ?? options.routeParam;
  if (sourceId == null || !travel.name) return null;
  const routeIdentifier = travel.slug ?? options.routeParam ?? travel.id;
  const key = `travel:${normalizeIdentifier(sourceId)}`;
  const route = `/travels/${encodeURIComponent(normalizeIdentifier(routeIdentifier ?? sourceId))}`;
  const publicSnapshot = buildTravelOfflineSnapshot(travel);
  const persist = async (
    signal: AbortSignal | undefined,
    onProgress: ((done: number, total: number) => void) | undefined,
  ) => {
    onProgress?.(0, options.includePhotos ? Math.max(1, buildTravelAssetSources(publicSnapshot).length) : 1);
    const packaged = options.includePhotos
      ? await downloadAndRewriteOfflineAssetSources(
        key,
        publicSnapshot,
        buildTravelAssetSources(publicSnapshot),
        { signal, onProgress },
      )
      : { snapshot: publicSnapshot, assets: [] };

    try {
      if (signal?.aborted) {
        throw Object.assign(new Error('OFFLINE_OPERATION_ABORTED'), { name: 'AbortError' });
      }
      const manifest = await offlineCatalog.save({
        key,
        type: 'travel',
        sourceId,
        authScope: 'public',
        route,
        title: travel.name,
        pinned: options.pinned,
        includePhotos: options.includePhotos,
        snapshot: packaged.snapshot,
        assets: packaged.assets,
      });
      onProgress?.(
        options.includePhotos ? Math.max(1, packaged.assets.length) : 1,
        options.includePhotos ? Math.max(1, packaged.assets.length) : 1,
      );
      return manifest;
    } catch (error) {
      if (packaged.assets.length) {
        const { default: offlineAssets } = await import('./offlineAssets');
        await offlineAssets.remove(packaged.assets);
      }
      throw error;
    }
  };

  if (options.pinned && options.trackOperation !== false && !options.signal) {
    return offlineOperations.run({
      key,
      type: 'travel',
      sourceId,
      route,
      title: travel.name,
    }, persist);
  }
  return persist(options.signal, options.onProgress);
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
