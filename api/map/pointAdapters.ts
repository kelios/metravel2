import type { TravelMediaImage, TravelsForMap } from '@/types/types';
import { readMapPlaceMarkerFields } from '@/api/mapPlaces';
import { indexMediaImage } from '@/utils/mediaPlaceholderIndex';
import { Platform } from 'react-native';
import { isBareMediaEndpointUrl, isPrivateOrLocalHost } from '@/utils/mediaUrl';

export const normalizeCoordString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

export const normalizeString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : fallback;
  }
  if (value == null) return fallback;
  return String(value);
};

export const normalizeImageUrl = (value: unknown): string => {
  const url = normalizeString(value, '');
  if (!url) return '';

  // Backend occasionally returns only media endpoint roots (e.g. /address-image/)
  // instead of real files. Treat such values as missing image to avoid 404 noise.
  if (isBareMediaEndpointUrl(url)) return '';

  // Upgrade absolute http URLs to https for non-local hosts (production CSP requires https images).
  if (/^http:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      const host = String(parsed.hostname || '').trim().toLowerCase();
      if (!isPrivateOrLocalHost(host)) {
        return url.replace(/^http:\/\//i, 'https://');
      }
    } catch {
      return url.replace(/^http:\/\//i, 'https://');
    }
  }

  // Если URL уже абсолютный, возвращаем как есть
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Если URL относительный, добавляем домен
  if (url.startsWith('/')) {
    const baseUrl = Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://metravel.by';
    return `${baseUrl}${url}`;
  }
  
  return url;
};

/**
 * Запись манифеста для точки карты: `media.address_images` ключуется id кадра,
 * который для точки совпадает с её `point_id`/`id`. Карточка показывает один
 * снимок, поэтому при неизвестном ключе берём первую запись.
 */
export const readMapPointMediaEntry = (
  item: Record<string, unknown>,
): TravelMediaImage | undefined => {
  const media = (item as { media?: { address_images?: Record<string, TravelMediaImage> } }).media;
  const images = media?.address_images;
  if (!images || typeof images !== 'object') return undefined;
  for (const id of [item.point_id, item.id]) {
    if (id === undefined || id === null) continue;
    const entry = images[String(id)];
    if (entry) return entry;
  }
  return Object.values(images)[0];
};

export const normalizeLatLngString = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : '';
  }
  return '';
};

export const normalizeTravelCoordsItem = (raw: unknown) => {
  const t = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {} as Record<string, unknown>;

  let lat = normalizeLatLngString(t.lat ?? t.latitude);
  let lng = normalizeLatLngString(t.lng ?? t.longitude);

  // If we have explicit lat/lng fields, use them to build coord in "lat,lng" format
  let coord: string | undefined;
  if (lat && lng) {
    coord = `${lat},${lng}`;
  } else {
    // Otherwise, try to parse from coord field
    const rawCoord = normalizeCoordString(t.coord);
    if (rawCoord) {
      // Try to extract lat/lng from coord string
      const parts = rawCoord.split(',').map(s => s.trim());
      if (parts.length === 2) {
        const a = parseFloat(parts[0]);
        const b = parseFloat(parts[1]);
        if (Number.isFinite(a) && Number.isFinite(b)) {
          // Determine if it's lat,lng or lng,lat based on valid ranges
          // Latitude: -90 to 90, Longitude: -180 to 180
          const isFirstLat = Math.abs(a) <= 90;
          const isSecondLat = Math.abs(b) <= 90;
          
          if (isFirstLat && !isSecondLat) {
            // First is lat, second is lng
            lat = String(a);
            lng = String(b);
            coord = `${lat},${lng}`;
          } else if (!isFirstLat && isSecondLat) {
            // First is lng, second is lat (old format)
            lat = String(b);
            lng = String(a);
            coord = `${lat},${lng}`;
          } else {
            // Both could be lat or both could be lng, use as-is but prefer lat,lng
            lat = String(a);
            lng = String(b);
            coord = `${lat},${lng}`;
          }
        } else {
          coord = rawCoord;
        }
      } else {
        coord = rawCoord;
      }
    }
  }

  const address =
    normalizeString(t.address ?? t.adress ?? t.full_address ?? t.name, '').trim() || undefined;

  const categoryName = normalizeString(
    t.categoryName ?? t.category_name ?? t.category ?? t.categoryTravelAddress,
    ''
  );

  const travelImageUrl = normalizeImageUrl(
    t.travelImageUrl ?? t.travel_image_url ?? t.imageUrl ?? t.image_url ?? t.image
  );

  const travelImageThumbUrl = normalizeImageUrl(
    t.travelImageThumbUrl ??
      t.travel_image_thumb_url ??
      t.travelImageThumbSmallUrl ??
      t.travel_image_thumb_small_url ??
      t.thumb ??
      travelImageUrl
  );
  const travelImageLandscapeUrl = normalizeImageUrl(
    t.travelImageLandscapeUrl ??
      t.travel_image_landscape_url ??
      t.imageLandscapeUrl ??
      t.image_landscape_url
  );

  const urlTravel = normalizeString(t.urlTravel ?? t.url_travel ?? t.url, '');
  const articleUrl = normalizeString(t.articleUrl ?? t.article_url, '') || undefined;

  // Заливка полей letterbox (#1208): карточка списка, попап маркера и нижняя
  // карточка рисуют `travelImageThumbUrl`/`travelImageUrl` — это legacy-конверсии,
  // которых в манифесте нет, поэтому цвет индексируется ещё и под ними.
  indexMediaImage(readMapPointMediaEntry(t), [
    travelImageThumbUrl,
    travelImageUrl,
    travelImageLandscapeUrl,
  ]);

  return {
    ...t,
    address,
    categoryName,
    coord,
    lat,
    lng,
    travelImageThumbUrl,
    travelImageLandscapeUrl,
    imageUrl: travelImageUrl || travelImageThumbUrl,
    urlTravel,
    articleUrl,
    // Спред `...t` пронёс бы только сырые snake_case place-поля — нормализуем их
    // в типизированные placeId/sourceCount/primarySource (#1567).
    ...readMapPlaceMarkerFields(t, normalizeImageUrl),
  };
};

const tryReadTotal = (payload: unknown): number | undefined => {
  if (!payload || typeof payload !== 'object') return undefined;
  const rec = payload as Record<string, unknown>;
  const maybe = rec.count ?? rec.total;
  const n = typeof maybe === 'string' ? Number(maybe) : maybe;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};

export const normalizeTravelsForMapPayload = (payload: unknown): TravelsForMap => {
  if (!payload) return {} as TravelsForMap;
  if (Array.isArray(payload)) {
    // Some backend endpoints historically returned arrays. Preserve that shape
    // to avoid breaking callers/tests that expect arrays.
    return payload.map((item) => normalizeTravelCoordsItem(item)) as unknown as TravelsForMap;
  }
  if (typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    const list = Array.isArray(obj?.results)
      ? obj.results
      : Array.isArray(obj?.data)
        ? obj.data
        : null;

    if (list) {
      const out: Record<string, unknown> = {};
      list.forEach((item: unknown, index: number) => {
        out[index] = normalizeTravelCoordsItem(item);
      });

      const total = tryReadTotal(obj);
      if (typeof total === 'number') {
        Object.defineProperty(out, '__total', {
          value: total,
          enumerable: false,
          configurable: false,
          writable: false,
        });
      }

      return out as TravelsForMap;
    }

    const out: Record<string, unknown> = {};
    Object.entries(payload as Record<string, unknown>).forEach(([key, value]) => {
      out[key] = normalizeTravelCoordsItem(value);
    });
    return out as TravelsForMap;
  }
  return {} as TravelsForMap;
};
