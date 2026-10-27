import type { Travel, TravelFormData, TravelPublicationFormat } from '@/types/types';
import type { TravelFilters } from '@/hooks/useTravelFilters';

export type TravelArticleCreateIntent = {
  sourceTravelId: string;
  country?: string;
  place?: string;
};

export type TravelArticleInitialPrefill = Pick<TravelFormData, 'name' | 'countries'>;

type ArticleContext = Pick<Travel, 'id' | 'cityName' | 'travelAddress' | 'countryCode'> & {
  countries?: unknown;
};

const hasControlCharacter = (value: string): boolean => Array.from(value).some((character) => {
  const code = character.charCodeAt(0);
  return code <= 31 || code === 127;
});

const positiveId = (value: unknown): string | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const text = String(value).trim();
  if (!/^[1-9]\d{0,15}$/.test(text) || !Number.isSafeInteger(Number(text))) return undefined;
  return String(Number(text));
};

const countryValue = (value: unknown): string | undefined => {
  const id = positiveId(value);
  if (id) return id;
  if (typeof value !== 'string' || !/^[a-z]{2}$/i.test(value.trim())) return undefined;
  return value.trim().toUpperCase();
};

const placeValue = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || hasControlCharacter(value)) return undefined;
  const place = value.replace(/\s+/g, ' ').trim();
  if (/^(?:https?:\/\/|\/|[[{])|[<>]/i.test(place)) return undefined;
  return place ? Array.from(place).slice(0, 120).join('') : undefined;
};

/** Only this creation route and its three public context fields survive a round trip. */
export function parseTravelArticleCreateIntent(
  params: Record<string, unknown> | string,
): TravelArticleCreateIntent | null {
  let values: Record<string, unknown> = typeof params === 'string' ? {} : params;
  if (!values || Array.isArray(values)) return null;
  if (typeof params === 'string') {
    if (hasControlCharacter(params)) return null;
    const [pathname, query = ''] = params.split('?');
    if (pathname !== '/travel/new' || params.includes('#')) return null;
    const search = new URLSearchParams(query);
    values = Object.fromEntries(['source_travel_id', 'country', 'place'].map((key) => {
      const entries = search.getAll(key);
      return [key, entries.length === 1 ? entries[0] : undefined];
    }));
  }
  const sourceTravelId = positiveId(values.source_travel_id);
  if (!sourceTravelId) return null;
  const country = countryValue(values.country);
  const place = placeValue(values.place);
  return {
    sourceTravelId,
    ...(country ? { country } : {}),
    ...(place ? { place } : {}),
  };
}

/**
 * Единственный строитель ссылки создания: режим (#2829: `mode=note` — короткая
 * заметка #2666) и контекст статьи живут в одном URL, поэтому вход через логин или
 * регистрацию возвращает автора в тот же режим и с тем же местом.
 */
export function buildTravelArticleCreateIntentHref(
  intent: TravelArticleCreateIntent | null,
  mode: TravelPublicationFormat = 'full',
): string {
  const normalized = intent ? parseTravelArticleCreateIntent({
    source_travel_id: intent.sourceTravelId,
    country: intent.country,
    place: intent.place,
  }) : null;
  const query = new URLSearchParams();
  if (mode === 'note') query.set('mode', 'note');
  if (normalized) {
    query.set('source_travel_id', normalized.sourceTravelId);
    if (normalized.country) query.set('country', normalized.country);
    if (normalized.place) query.set('place', normalized.place);
  }
  const search = query.toString();
  return search ? `/travel/new?${search}` : '/travel/new';
}

/** Вход в короткую заметку из меню — без контекста статьи. */
export const TRAVEL_NOTE_CREATE_HREF = buildTravelArticleCreateIntentHref(null, 'note');

export function buildTravelArticleCreateHref(
  travel: ArticleContext,
  mode: TravelPublicationFormat = 'full',
): string {
  const sourceTravelId = positiveId(travel.id);
  if (!sourceTravelId) return buildTravelArticleCreateIntentHref(null, mode);
  const countries = Array.isArray(travel.countries) ? travel.countries : [];
  const country = countries.map((value: unknown) => {
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      return positiveId(record.country_id ?? record.id ?? record.pk ?? record.value);
    }
    return positiveId(value);
  }).find(Boolean) ?? countryValue(travel.countryCode);
  const firstPoint = (travel.travelAddress || []).map((point) => (
    placeValue(typeof point === 'string' ? point : point?.name)
  )).find(Boolean);
  const place = placeValue(travel.cityName) ?? firstPoint;
  return buildTravelArticleCreateIntentHref({ sourceTravelId, country, place }, mode);
}

export function resolveInitialPrefill(
  intent: TravelArticleCreateIntent,
  catalog: TravelFilters['countries'],
): TravelArticleInitialPrefill {
  const matches = catalog.filter((country) => {
    if (!positiveId(country.country_id)) return false;
    if (positiveId(intent.country)) return positiveId(country.country_id) === intent.country;
    return [country.country_code, country.code, country.iso2, country.iso, country.alpha2,
      country.alpha_2, country.ISO3166_1_alpha2]
      .some((code) => typeof code === 'string' && code.trim().toUpperCase() === intent.country);
  });
  const ids = [...new Set(matches.map((country) => positiveId(country.country_id)!))];
  return { name: intent.place ?? '', countries: ids.length === 1 ? ids : [] };
}
