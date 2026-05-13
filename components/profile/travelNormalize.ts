import type { Travel } from '@/types/types';

export type ProfileListItem = {
  type?: string;
  id?: unknown;
  title?: unknown;
  url?: unknown;
  imageUrl?: unknown;
  country?: unknown;
  city?: unknown;
};

export const isTravelListItem = (value: unknown): value is ProfileListItem =>
  !!value && typeof value === 'object' && (value as ProfileListItem).type === 'travel';

const getSlugFromUrl = (url: string | undefined | null, fallback: string) => {
  const raw = String(url ?? '').trim();
  if (!raw) return fallback;
  const noQuery = raw.split('?')[0]?.replace(/\/+$/, '') ?? raw;
  const match = noQuery.match(/\/travels\/([^/]+)$/);
  return match?.[1] ? String(match[1]) : fallback;
};

const getMonthName = (item: Record<string, unknown>): string => {
  const direct = item?.monthName ?? item?.month_name;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  const month = item?.month;
  const firstMonth = Array.isArray(month) ? month[0] : month;
  if (firstMonth && typeof firstMonth === 'object') {
    const record = firstMonth as Record<string, unknown>;
    const label = record.name ?? record.title ?? record.text ?? record.value ?? record.id;
    return label == null ? '' : String(label).trim();
  }

  return firstMonth == null ? '' : String(firstMonth).trim();
};

export const normalizeToTravel = (item: Record<string, unknown>): Travel => {
  const idRaw = item?.id ?? item?._id ?? 0;
  const id = typeof idRaw === 'number' ? idRaw : Number(idRaw) || 0;
  const url = String(item?.url ?? item?.urlTravel ?? item?.href ?? '').trim();
  const slug = String(item?.slug ?? getSlugFromUrl(url, String(id || item?.id || ''))).trim();
  const name = String(item?.name ?? item?.title ?? '').trim() || 'Без названия';

  const travel_image_thumb_url =
    String(
      item?.travel_image_thumb_url ??
        item?.travel_image_thumb_small_url ??
        item?.travelImageThumbUrl ??
        item?.travelImageThumbSmallUrl ??
        item?.imageUrl ??
        ''
    ).trim();

  const countryName = String(item?.countryName ?? item?.country ?? '').trim();
  const cityName = String(item?.cityName ?? item?.city ?? '').trim();
  const countUnicIpView = String(item?.countUnicIpView ?? item?.views ?? '0');

  return {
    id,
    slug,
    name,
    travel_image_thumb_url,
    travel_image_thumb_small_url: travel_image_thumb_url,
    url: url || `/travels/${slug || id}`,
    youtube_link: '',
    userName: String(item?.userName ?? item?.authorName ?? ''),
    description: String(item?.description ?? ''),
    recommendation: String(item?.recommendation ?? ''),
    plus: String(item?.plus ?? ''),
    minus: String(item?.minus ?? ''),
    cityName,
    countryName,
    countUnicIpView,
    gallery: Array.isArray(item?.gallery) ? item.gallery : [],
    travelAddress: Array.isArray(item?.travelAddress) ? item.travelAddress : [],
    userIds: String(item?.userIds ?? item?.userId ?? (item?.user as Record<string, unknown> | undefined)?.id ?? ''),
    year: String(item?.year ?? ''),
    monthName: getMonthName(item),
    number_days: Number(item?.number_days ?? 0) || 0,
    companions: Array.isArray(item?.companions) ? item.companions : [],
    coordsMeTravel: Array.isArray(item?.coordsMeTravel) ? item.coordsMeTravel : undefined,
    countryCode: String(item?.countryCode ?? ''),
    user: item?.user as Travel['user'],
    created_at: item?.created_at as string | undefined,
    updated_at: item?.updated_at as string | undefined,
  };
};
