// api/plannedTripsMock.ts
// Мок-данные планирования поездок (Sprint 13). Используются до готовности
// бэкенда (BE-trip-*). Координаты — реальные точки Беларуси для адекватной
// оценки сводки маршрута. Не путать с api/publicTripsMock.ts.

import type {
  PlannedTrip,
  RoutePoint,
  RouteTemplate,
  TripSuggestion,
} from '@/api/plannedTrips';

/** Глубокая копия — мок-стор мутируется в DEV, не делимся ссылками. */
export const cloneTrip = (t: PlannedTrip): PlannedTrip => ({
  ...t,
  startPoint: t.startPoint ? { ...t.startPoint } : null,
  organizer: { ...t.organizer },
  route: t.route.map((p) => ({ ...p })),
  routeGeometry: t.routeGeometry ? t.routeGeometry.map((p) => [p[0], p[1]]) : null,
  routeSummary: t.routeSummary ? { ...t.routeSummary } : null,
  routingState: t.routingState ? { ...t.routingState, warnings: [...t.routingState.warnings] } : null,
  participants: t.participants.map((p) => ({ ...p })),
  report: t.report
    ? {
        ...t.report,
        photoUrls: [...t.report.photoUrls],
        visitedPlaceIds: [...t.report.visitedPlaceIds],
      }
    : null,
});

const pt = (
  id: string,
  type: RoutePoint['type'],
  name: string,
  coordinates: [number, number] | null,
  extra?: Partial<RoutePoint>,
): RoutePoint => ({
  id,
  type,
  name,
  description: extra?.description ?? null,
  coordinates,
  placeId: extra?.placeId ?? null,
});

export const MOCK_PLANNED_TRIPS: PlannedTrip[] = [
  {
    id: 8001,
    slug: '8001',
    title: 'Браславские озёра на выходные',
    description:
      'Двухдневный выезд на машине по Браславскому Поозерью: смотровая на горе Маяк, замковая гора, ночёвка у воды.',
    startDate: '2026-07-11',
    startTime: '08:00',
    transport: 'car',
    visibility: 'public',
    seatsTotal: 4,
    startPoint: pt('p0', 'place', 'Минск, площадь Победы', [27.5709, 53.9091]),
    status: 'planning',
    organizer: { id: 0, name: 'Вы', avatarUrl: null },
    route: [
      pt('p0', 'place', 'Минск, площадь Победы', [27.5709, 53.9091]),
      pt('p1', 'rest', 'Кафе в Глубоком', [27.6857, 55.1369], {
        description: 'Кофе и знаменитые глубокские пряники',
      }),
      pt('p2', 'place', 'Гора Маяк, смотровая', [27.0419, 55.6206], {
        description: 'Панорама на озёра Снуды и Струсто',
        placeId: 563,
      }),
      pt('p3', 'overnight', 'Кемпинг на озере Дривяты', [27.0494, 55.6019]),
    ],
    routeGeometry: [
      [27.5709, 53.9091],
      [27.6201, 54.2350],
      [27.6857, 55.1369],
      [27.3180, 55.3820],
      [27.0419, 55.6206],
      [27.0494, 55.6019],
    ],
    routeSummary: { distanceKm: 252.4, durationMin: 252, elevationGainM: 2019, stopsCount: 3 },
    routingState: { provider: 'ors', isOptimal: true, fallbackReason: null, warnings: [] },
    participants: [
      { id: 0, name: 'Вы', avatarUrl: null, rsvp: 'going', role: 'organizer' },
      { id: 12, name: 'Анна К.', avatarUrl: null, rsvp: 'going', role: 'participant' },
      { id: 34, name: 'Игорь П.', avatarUrl: null, rsvp: 'maybe', role: 'participant' },
      { id: 56, name: 'Светлана М.', avatarUrl: null, rsvp: 'invited', role: 'participant' },
    ],
    coverUrl: null,
    region: 'Витебская область',
    publishedToCommunity: false,
    report: null,
    isOwner: true,
    myRsvp: 'going',
    createdAt: '2026-06-18T10:00:00.000Z',
  },
  {
    id: 8002,
    slug: '8002',
    title: 'Велодень по Минску',
    description:
      'Лёгкий городской веломаршрут по набережной Свислочи с остановками у главных точек.',
    startDate: '2026-06-28',
    startTime: '10:30',
    transport: 'bike',
    visibility: 'followers',
    seatsTotal: 8,
    startPoint: pt('q0', 'place', 'Парк Горького', [27.5774, 53.9028]),
    status: 'planning',
    organizer: { id: 12, name: 'Анна К.', avatarUrl: null },
    route: [
      pt('q0', 'place', 'Парк Горького', [27.5774, 53.9028]),
      pt('q1', 'custom', 'Остров слёз', [27.5536, 53.9072]),
      pt('q2', 'rest', 'Кофейня на Зыбицкой', [27.5577, 53.9039]),
      pt('q3', 'place', 'Парк Победы, велодорожка', [27.5394, 53.9268]),
    ],
    routeGeometry: null,
    routeSummary: { distanceKm: 9.7, durationMin: 36, elevationGainM: 78, stopsCount: 3 },
    routingState: { provider: 'direct', isOptimal: false, fallbackReason: 'routing_provider_unavailable', warnings: ['Маршрут показан приблизительно.'] },
    participants: [
      { id: 12, name: 'Анна К.', avatarUrl: null, rsvp: 'going', role: 'organizer' },
      { id: 0, name: 'Вы', avatarUrl: null, rsvp: 'maybe', role: 'participant' },
    ],
    coverUrl: null,
    region: 'Минск',
    publishedToCommunity: false,
    report: null,
    isOwner: false,
    myRsvp: 'maybe',
    createdAt: '2026-06-15T12:00:00.000Z',
  },
  {
    id: 8003,
    slug: '8003',
    title: 'Несвиж — Мир за один день',
    description:
      'Классический автомаршрут к двум замкам ЮНЕСКО с обедом между ними. Маршрут пройден и опубликован.',
    startDate: '2026-05-24',
    startTime: '09:00',
    transport: 'car',
    visibility: 'public',
    seatsTotal: 4,
    startPoint: pt('r0', 'place', 'Минск', [27.5615, 53.9023]),
    status: 'completed',
    organizer: { id: 0, name: 'Вы', avatarUrl: null },
    route: [
      pt('r0', 'place', 'Минск', [27.5615, 53.9023]),
      pt('r1', 'place', 'Несвижский замок', [26.6906, 53.2225], { placeId: 100 }),
      pt('r2', 'rest', 'Обед в Несвиже', [26.6986, 53.2233]),
      pt('r3', 'place', 'Мирский замок', [26.4731, 53.4511], { placeId: 101 }),
    ],
    routeGeometry: [
      [27.5615, 53.9023],
      [27.1800, 53.6800],
      [26.6906, 53.2225],
      [26.6986, 53.2233],
      [26.4731, 53.4511],
    ],
    routeSummary: { distanceKm: 178.5, durationMin: 178, elevationGainM: 1428, stopsCount: 3 },
    routingState: { provider: 'ors', isOptimal: true, fallbackReason: null, warnings: [] },
    participants: [
      { id: 0, name: 'Вы', avatarUrl: null, rsvp: 'going', role: 'organizer' },
      { id: 34, name: 'Игорь П.', avatarUrl: null, rsvp: 'going', role: 'participant' },
    ],
    coverUrl: null,
    region: 'Минская область',
    publishedToCommunity: true,
    report: {
      summary:
        'Отличная погода, успели оба замка. В Мире был концерт во дворе — большой плюс. Парковка у Несвижа платная.',
      photoUrls: [],
      gpxUrl: null,
      visitedPlaceIds: [100, 101],
      published: true,
      publishedAt: '2026-05-25T18:00:00.000Z',
    },
    isOwner: true,
    myRsvp: 'going',
    createdAt: '2026-05-10T09:00:00.000Z',
  },
];

export const MOCK_ROUTE_TEMPLATES: RouteTemplate[] = [
  {
    id: 'tpl-castles',
    title: 'Замки за один день',
    description: 'Несвиж → обед → Мир. Классика выходного дня на машине.',
    transport: 'car',
    points: [
      { type: 'place', name: 'Несвижский замок', description: null, coordinates: [26.6906, 53.2225], placeId: 100 },
      { type: 'rest', name: 'Обед', description: null, coordinates: [26.6986, 53.2233], placeId: null },
      { type: 'place', name: 'Мирский замок', description: null, coordinates: [26.4731, 53.4511], placeId: 101 },
    ],
  },
  {
    id: 'tpl-lakes',
    title: 'Озёра Поозерья (2 дня)',
    description: 'Глубокое → гора Маяк → ночёвка на озере. Для машины с палаткой.',
    transport: 'car',
    points: [
      { type: 'rest', name: 'Глубокое', description: null, coordinates: [27.6857, 55.1369], placeId: null },
      { type: 'place', name: 'Гора Маяк', description: null, coordinates: [27.0419, 55.6206], placeId: 563 },
      { type: 'overnight', name: 'Кемпинг у озера', description: null, coordinates: [27.0494, 55.6019], placeId: null },
    ],
  },
  {
    id: 'tpl-city-bike',
    title: 'Городской велодень',
    description: 'Кольцо по набережной с кофейными остановками.',
    transport: 'bike',
    points: [
      { type: 'place', name: 'Парк Горького', description: null, coordinates: [27.5774, 53.9028], placeId: null },
      { type: 'rest', name: 'Кофейня', description: null, coordinates: [27.5577, 53.9039], placeId: null },
      { type: 'place', name: 'Парк Победы', description: null, coordinates: [27.5394, 53.9268], placeId: null },
    ],
  },
];

export const MOCK_TRIP_SUGGESTIONS: TripSuggestion[] = [
  {
    id: 7001,
    tripId: 8001,
    author: { id: 12, name: 'Анна К.', avatarUrl: null },
    point: pt('sg1', 'place', 'Замковая гора в Браславе', [27.0411, 55.6347], {
      description: 'По пути, занимает 20 минут — отличная панорама',
    }),
    status: 'pending',
    createdAt: '2026-06-19T08:30:00.000Z',
  },
  {
    id: 7002,
    tripId: 8001,
    author: { id: 34, name: 'Игорь П.', avatarUrl: null },
    point: pt('sg2', 'rest', 'Заправка перед Браславом', [27.1, 55.5], {
      description: 'Последняя нормальная заправка на маршруте',
    }),
    status: 'pending',
    createdAt: '2026-06-19T09:15:00.000Z',
  },
];
