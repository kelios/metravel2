export type TravelPreview = {
  id: number;
  slug?: string;
  name?: string;
  title?: string;
  url?: string;
  travel_image_thumb_small_url?: string;
  travel_image_thumb_url?: string;
  imageUrl?: string;
  cityName?: string;
  city?: string;
  countryName?: string;
  country?: string;
};

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

export const normalizeTravelPreview = (value: unknown): TravelPreview => {
  const source = toRecord(value);
  const idRaw = source.id ?? source._id ?? 0;
  const id = typeof idRaw === 'number' ? idRaw : Number(idRaw) || 0;

  return {
    id,
    slug: typeof source.slug === 'string' ? source.slug : undefined,
    name: typeof source.name === 'string' ? source.name : undefined,
    title: typeof source.title === 'string' ? source.title : undefined,
    url: typeof source.url === 'string' ? source.url : undefined,
    travel_image_thumb_small_url:
      typeof source.travel_image_thumb_small_url === 'string'
        ? source.travel_image_thumb_small_url
        : undefined,
    travel_image_thumb_url:
      typeof source.travel_image_thumb_url === 'string'
        ? source.travel_image_thumb_url
        : undefined,
    imageUrl: typeof source.imageUrl === 'string' ? source.imageUrl : undefined,
    cityName: typeof source.cityName === 'string' ? source.cityName : undefined,
    city: typeof source.city === 'string' ? source.city : undefined,
    countryName: typeof source.countryName === 'string' ? source.countryName : undefined,
    country: typeof source.country === 'string' ? source.country : undefined,
  };
};

export const resolveTravelUrl = (travel: TravelPreview): string => {
  const explicitUrl = String(travel.url ?? '').trim();
  if (explicitUrl) return explicitUrl;
  const key = String(travel.slug ?? travel.id).trim();
  return `/travels/${key || travel.id}`;
};

