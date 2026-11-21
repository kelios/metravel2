import type { RoutePoint } from '@/api/plannedTrips'
import { cleanDraftPoint, parseSourcePoint, type TripPlanDraft, type TripPlanDraftPoint } from '@/utils/tripPlanDraft'
import { addCalendarDays } from '@/utils/tripDateTime'
import { clip, firstParam, getDefaultTripStartDate, TRIP_PLAN_TITLE_MAX as TITLE_MAX, type TripPlanPrefill, type TripPlanSourceParams } from '@/utils/tripPlanLinks'

/**
 * Приём точек маршрута формой новой поездки (#3298, #3416 п.1): черновик плана ассистента и одна точка
 * материала из параметров ссылки превращаются в точки маршрута и подстановку формы.
 *
 * Модуль грузит только экран `/trips/plan/create`. Сборка ссылки на форму (`utils/tripPlanLinks.ts` — её
 * грузит страница статьи) и хранилище черновика (`utils/tripPlanDraft.ts` — его грузит экран ассистента)
 * от него не зависят и модули маршрута поездки за собой не тянут. Предел названия, чтение параметра и
 * обрезка текста берутся из `utils/tripPlanLinks.ts` — своих копий здесь нет (#3431 В1).
 */
const TRIP_PLAN_POINT_SOURCES = ['travel', 'quest']

/**
 * Точки черновика → точки маршрута поездки в порядке дней. Статья — «Место» с привязкой `placeId`, квест —
 * обычная точка (в домене точки квеста нет), как у блока «Рядом с маршрутом».
 */
export const draftRoutePoints = (points: readonly TripPlanDraftPoint[]): RoutePoint[] =>
  points.map((point, index) => ({
    id: `draft-${point.type}-${point.sourceId ?? index}-${index}`,
    type: point.type === 'travel' ? 'place' : 'custom',
    name: point.title,
    description: point.note ?? null,
    coordinates: [point.lng, point.lat],
    placeId: point.type === 'travel' && point.sourceId ? point.sourceId : null,
    dayNumber: point.day ?? null,
  }))

/**
 * Точки маршрута, с которыми открыта форма новой поездки по материалу (#3416 п.1): параметр
 * `sourcePoint=<lat>,<lng>` и название материала из той же ссылки. Статья привязывается к месту по
 * `sourceTravelId`, квест встаёт обычной точкой. Нет координат или названия — точек нет.
 */
export function buildTripPlanRoutePrefill(params: TripPlanSourceParams): RoutePoint[] {
  const source = firstParam(params.source);
  if (!TRIP_PLAN_POINT_SOURCES.includes(source)) return [];
  const point = parseSourcePoint(params.sourcePoint);
  const title = clip(firstParam(params.sourceTravelTitle), TITLE_MAX);
  if (!point || !title) return [];
  const travelId = Number(firstParam(params.sourceTravelId));
  const url = firstParam(params.sourceTravelUrl);
  // Параметры адреса — недоверенные данные: та же очистка, что у черновика из хранилища (длина подписи).
  const cleaned = cleanDraftPoint({
    type: source === 'travel' ? 'travel' : 'quest',
    sourceId: Number.isInteger(travelId) && travelId > 0 ? travelId : null,
    title,
    lat: point.lat,
    lng: point.lng,
    note: /^https?:\/\//i.test(url) ? url : null,
  });
  return cleaned ? draftRoutePoints([cleaned]) : [];
}

/** Подстановка формы из черновика плана ассистента (#3298): название, описание по дням и дата окончания. */
export function buildTripPlanPrefillFromDraft(draft: TripPlanDraft, startDate: string = getDefaultTripStartDate()): TripPlanPrefill {
  const endDate = draft.days > 1 ? addCalendarDays(startDate, draft.days - 1) : null;
  return {
    title: clip(draft.title, TITLE_MAX),
    description: draft.description,
    startDate,
    ...(endDate ? { endDate } : {}),
  };
}
