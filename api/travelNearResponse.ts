import { ApiError } from '@/api/clientErrors';
import { normalizeTravelItem } from '@/api/travelsNormalize';
import { translate as i18nT } from '@/i18n';
import type { Travel } from '@/types/types';

type NearTravelCardDto = Record<string, unknown> & {
  id: number;
  name?: string;
  title?: string;
  url?: string;
  slug?: string;
  countryName?: string;
  cityName?: string;
  year?: number | null;
  rating?: number | null;
  lat?: number | null;
  lng?: number | null;
  coord?: string | null;
};

type NearTravelsEnvelope = {
  count: number;
  next: string | null;
  previous: string | null;
  results: NearTravelCardDto[];
};

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';

const hasValidCoverSource = (item: Record<string, unknown>): boolean => {
  if (!('media' in item) || item.media == null) return true;
  if (typeof item.media !== 'object' || Array.isArray(item.media)) return false;

  const media = item.media as Record<string, unknown>;
  if (!('cover' in media) || media.cover == null) return true;
  if (typeof media.cover !== 'object' || Array.isArray(media.cover)) return false;

  const cover = media.cover as Record<string, unknown>;
  return !('src' in cover) || cover.src == null || typeof cover.src === 'string';
};

const isNearTravelCardDto = (value: unknown): value is NearTravelCardDto => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== 'number' || !Number.isInteger(item.id) || item.id <= 0) return false;

  for (const key of ['name', 'title', 'url', 'slug', 'countryName', 'cityName'] as const) {
    if (key in item && typeof item[key] !== 'string') return false;
  }
  for (const key of ['year', 'rating'] as const) {
    const field = item[key];
    if (key in item && field !== null && (typeof field !== 'number' || !Number.isFinite(field))) {
      return false;
    }
  }
  for (const key of ['lat', 'lng'] as const) {
    const field = item[key];
    if (key in item && field !== null && (typeof field !== 'number' || !Number.isFinite(field))) {
      return false;
    }
  }
  if ('coord' in item && item.coord !== null && typeof item.coord !== 'string') return false;
  for (const key of ['points', 'travelAddress', 'travel_address', 'travel_points', 'pointsList']) {
    if (key in item && item[key] != null && !Array.isArray(item[key])) return false;
  }
  if (typeof item.year === 'number' && !Number.isInteger(item.year)) return false;
  return hasValidCoverSource(item);
};

const isNearTravelsEnvelope = (value: unknown): value is NearTravelsEnvelope => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const envelope = value as Record<string, unknown>;
  const { count, next, previous, results } = envelope;
  return (
    typeof count === 'number' &&
    Number.isInteger(count) &&
    count >= 0 &&
    isNullableString(next) &&
    isNullableString(previous) &&
    Array.isArray(results) &&
    results.every(isNearTravelCardDto) &&
    count >= results.length &&
    (results.length > 0 || count === 0)
  );
};

const normalizeNearTravelCard = (item: NearTravelCardDto): Travel => {
  const travel = normalizeTravelItem(item);
  const rawCoverSrc = travel.media?.cover?.src;
  const coverSrc = typeof rawCoverSrc === 'string' ? rawCoverSrc.trim() : '';

  if (!coverSrc || travel.travel_image_thumb_url) return travel;

  // The nearby endpoint exposes the canonical media manifest only. The two
  // existing nearby-card variants still use the legacy thumbnail field as the
  // ImageCardMedia activation source, so keep that compatibility alias local
  // to this response adapter while preserving `media.cover` for srcset/blur.
  return {
    ...travel,
    travel_image_thumb_url: coverSrc,
    travel_image_thumb_small_url: travel.travel_image_thumb_small_url || coverSrc,
  };
};

export const parseNearTravelsEnvelope = (payload: unknown, limit?: number): Travel[] => {
  if (!isNearTravelsEnvelope(payload)) {
    throw new ApiError(
      502,
      i18nT('errorsStatic:utils.network.requestFailed'),
      { code: 'INVALID_NEAR_TRAVELS_RESPONSE' },
    );
  }

  const resultLimit = Number.isFinite(limit) && limit && limit > 0
    ? Math.max(1, Math.floor(limit))
    : payload.results.length;
  return payload.results.slice(0, resultLimit).map(normalizeNearTravelCard);
};
