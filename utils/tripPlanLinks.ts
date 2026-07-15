import type { Travel } from '@/types/types';
import { buildCanonicalUrl } from '@/utils/seo';
import { buildTravelPath, stripHtmlForSeo } from '@/utils/travelSeo';
import { translate as i18nT } from '@/i18n'


type TravelPlanSource = Pick<Travel, 'id' | 'slug' | 'name' | 'description'>;

export interface TripPlanPrefill {
  title?: string;
  description?: string;
  startDate?: string;
}

export type TripPlanSourceParams = Record<string, string | string[] | undefined>;

export interface TripPlanShareSource {
  id: string | number;
  title?: string | null;
}

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

const normalizeTripPlanId = (id: string | number): string => {
  const value = String(id ?? '').trim();
  return /^[1-9]\d*$/.test(value) ? value : '';
};

export function buildTripPlanPath(trip: TripPlanShareSource): string {
  const id = normalizeTripPlanId(trip.id);
  return id ? `/trips/plan/${encodeURIComponent(id)}` : '';
}

export function buildTripPlanUrl(trip: TripPlanShareSource): string {
  const path = buildTripPlanPath(trip);
  return path ? buildCanonicalUrl(path) : '';
}

export function buildTripShareText(trip: TripPlanShareSource): string {
  const title = clip(String(trip.title ?? '').trim(), TITLE_MAX);
  return title
    ? i18nT('trips:utils.tripPlanLinks.prisoedinyaytes_k_poezdke_value1_v_metravel_33d359a2', { value1: title })
    : i18nT('trips:utils.tripPlanLinks.prisoedinyaytes_k_poezdke_v_metravel_1843c27d');
}

export function buildTripTelegramShareUrl(trip: TripPlanShareSource): string {
  const url = buildTripPlanUrl(trip);
  if (!url) return '';
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(buildTripShareText(trip))}`;
}

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

  const title = sourceTitle ? i18nT('trips:utils.tripPlanLinks.poezdka_po_marshrutu_value1_96b48431', { value1: sourceTitle }) : '';
  const descriptionParts = [
    sourceTitle ? i18nT('trips:utils.tripPlanLinks.hochu_organizovat_poezdku_po_marshrutu_value_c44e87b7', { value1: sourceTitle }) : '',
    sourceDescription,
    sourceUrl ? i18nT('trips:utils.tripPlanLinks.ishodnyy_marshrut_value1_493b6050', { value1: sourceUrl }) : '',
  ].filter(Boolean);

  return {
    title: clip(title, TITLE_MAX),
    description: descriptionParts.join('\n\n'),
  };
}
