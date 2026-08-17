import { buildTravelPath } from '@/utils/routePaths';

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

/**
 * Адрес страницы путешествия. Пустая строка означает «ссылки нет» — вызывающий
 * не должен ни рисовать её, ни выполнять переход.
 *
 * #1185: раньше последней веткой был безусловный `/travels/${travel.id}`. Поле
 * объявлено как `number`, но с бэкенда приходит и `null`, и шаблон отдавал
 * строку `/travels/null` — в проде это 5 переходов на 404 за двое суток.
 */
export const resolveTravelUrl = (travel: TravelPreview): string => {
  const slug = String(travel.slug ?? '').trim();
  if (slug) return `/travels/${slug}`;
  const explicitUrl = String(travel.url ?? '').trim();
  if (explicitUrl) {
    const clean = explicitUrl.split('?')[0].split('#')[0];
    // #1438: серверное `url` уходило в `href` карточки как есть. Это
    // единственный настоящий `<a href>` с travel-адресом на странице статьи
    // (`TravelListItem`), поэтому запись с `/travels/null` в этом поле стала бы
    // кликабельной ссылкой в 404. Сегмент проверяем тем же гардом, что и id.
    if (isUsableTravelUrl(clean)) return clean;
  }
  return buildTravelPath(travel.id) ?? '';
};

/**
 * `true`, если адрес не является travel-страницей с непригодным сегментом
 * (`/travels/null`, `/travels/undefined`, `/travels/0`). Не-travel адреса
 * пропускаем как есть: это поле бэкенд использует и для внешних ссылок.
 */
function isUsableTravelUrl(url: string): boolean {
  const match = url.match(/\/travels\/([^/]+)\/?$/);
  if (!match) return true;
  return buildTravelPath(decodeSegmentSafely(match[1])) !== null;
}

function decodeSegmentSafely(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
