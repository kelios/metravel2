import type { Travel } from '@/types/types';
import { buildCanonicalUrl } from '@/utils/seo';
import { buildTravelPath, stripHtmlForSeo } from '@/utils/travelSeo';
import { translate as i18nT } from '@/i18n'


type TravelPlanSource = Pick<Travel, 'id' | 'slug' | 'name' | 'description'>;

export interface TripPlanPrefill {
  title?: string;
  description?: string;
  startDate?: string;
  /** День окончания: у черновика плана на несколько дней — старт плюс число дней минус один (#3298). */
  endDate?: string;
}

export type TripPlanSourceParams = Record<string, string | string[] | undefined>;

export interface TripPlanShareSource {
  id: string | number;
  title?: string | null;
}

/**
 * Предел названия поездки, первое значение параметра ссылки и обрезка по слову — один источник для сборки
 * ссылки и для приёма точек формой (`utils/tripPlanDraftIntake.ts`, #3431 В1): тот модуль уже импортирует
 * этот, новых связей в графе чанков экспорт не добавляет.
 */
export const TRIP_PLAN_TITLE_MAX = 96;
const TITLE_MAX = TRIP_PLAN_TITLE_MAX;
const SOURCE_URL_MAX = 500;
const DESCRIPTION_MAX = 420;

export const firstParam = (value: string | string[] | undefined): string => {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' ? raw.trim() : '';
};

export const clip = (value: string, max: number): string => {
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

/**
 * Координаты одной точки материала для параметра ссылки `sourcePoint=<lat>,<lng>` (#3416 п.1); кривые
 * координаты — пустая строка. Чистая функция без зависимостей: этот модуль грузит страница статьи
 * (`CTASection`), поэтому хранилище черновика и приём точек сюда не импортируются — они живут в
 * `utils/tripPlanDraft.ts` и `utils/tripPlanDraftIntake.ts`, которые грузят только экран ассистента и
 * форма новой поездки. 15.11.2026 их статический импорт отсюда добавил странице статьи лишний
 * eager-запрос (19 при потолке 18), и выкат остановил страж бюджета бандла.
 */
export function formatSourcePoint(lat: number | null | undefined, lng: number | null | undefined): string {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return '';
  const [latitude, longitude] = [Number(lat), Number(lng)];
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return '';
  return `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
}

/** Материал сайта, по которому посетитель собирает поездку вне страницы статьи (#3295: квест из ответа ассистента). */
export interface TripPlanMaterialSource {
  title: string;
  /** Абсолютный адрес материала на сайте. */
  url: string;
  description?: string | null;
  /** Координаты материала (#3416 п.1): есть — после создания поездки материал встаёт точкой её маршрута. */
  lat?: number | null;
  lng?: number | null;
}

/**
 * Ссылка на форму новой поездки по квесту — те же параметры подстановки, что у статьи
 * (`buildTripPlanCreateHref`): название, адрес и описание материала. Идентификатора статьи нет:
 * квест в домене поездки — не статья.
 */
export function buildTripPlanCreateHrefFromQuest(quest: TripPlanMaterialSource): string {
  const params = new URLSearchParams();
  const title = clip(stripHtmlForSeo(quest.title), TITLE_MAX);
  const description = clip(stripHtmlForSeo(quest.description ?? ''), DESCRIPTION_MAX);

  params.set('source', 'quest');
  if (title) params.set('sourceTravelTitle', title);
  if (/^https?:\/\//i.test(quest.url)) params.set('sourceTravelUrl', quest.url);
  if (description) params.set('sourceTravelDescription', description);
  const point = formatSourcePoint(quest.lat, quest.lng);
  if (point) params.set('sourcePoint', point);

  return `/trips/plan/create?${params.toString()}`;
}

const TRIP_PLAN_SOURCES = ['travel', 'quest'];

export function buildTripPlanPrefill(params: TripPlanSourceParams): TripPlanPrefill {
  if (!TRIP_PLAN_SOURCES.includes(firstParam(params.source))) return {};

  const sourceTitle = firstParam(params.sourceTravelTitle);
  // Адрес приходит из строки запроса: в описание идёт только http(s)-ссылка разумной длины.
  const rawSourceUrl = firstParam(params.sourceTravelUrl);
  const sourceUrl = /^https?:\/\//i.test(rawSourceUrl) && rawSourceUrl.length <= SOURCE_URL_MAX ? rawSourceUrl : '';
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
