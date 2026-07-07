import type { Travel } from '@/types/types';
import { buildCanonicalUrl } from '@/utils/seo';
import { buildTravelPath, stripHtmlForSeo } from '@/utils/travelSeo';

type TravelPlanSource = Pick<Travel, 'id' | 'slug' | 'name' | 'description'>;

export interface TripPlanPrefill {
  title?: string;
  description?: string;
}

export type TripPlanSourceParams = Record<string, string | string[] | undefined>;

const TITLE_MAX = 96;
const DESCRIPTION_MAX = 420;

const firstParam = (value: string | string[] | undefined): string => {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' ? raw.trim() : '';
};

const clip = (value: string, max: number): string => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  const cut = normalized.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const wordSafe = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${wordSafe.trimEnd()}...`;
};

export function getDefaultTripStartDate(now = new Date()): string {
  const date = new Date(now);
  const daysUntilSaturday = (6 - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntilSaturday);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildTripPlanCreateHref(travel: TravelPlanSource): string {
  const path = buildTravelPath(travel);
  const params = new URLSearchParams();
  const title = clip(stripHtmlForSeo(travel.name), TITLE_MAX);
  const description = clip(stripHtmlForSeo(travel.description), DESCRIPTION_MAX);

  params.set('source', 'travel');
  params.set('sourceTravelId', String(travel.id));
  if (title) params.set('sourceTravelTitle', title);
  if (path) params.set('sourceTravelUrl', buildCanonicalUrl(path));
  if (description) params.set('sourceTravelDescription', description);

  return `/trips/plan/create?${params.toString()}`;
}

export function buildTripPlanPrefill(params: TripPlanSourceParams): TripPlanPrefill {
  if (firstParam(params.source) !== 'travel') return {};

  const sourceTitle = firstParam(params.sourceTravelTitle);
  const sourceUrl = firstParam(params.sourceTravelUrl);
  const sourceDescription = firstParam(params.sourceTravelDescription);

  const title = sourceTitle ? `Поездка по маршруту "${sourceTitle}"` : '';
  const descriptionParts = [
    sourceTitle ? `Хочу организовать поездку по маршруту "${sourceTitle}".` : '',
    sourceDescription,
    sourceUrl ? `Исходный маршрут: ${sourceUrl}` : '',
  ].filter(Boolean);

  return {
    title: clip(title, TITLE_MAX),
    description: descriptionParts.join('\n\n'),
  };
}
