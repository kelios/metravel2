import type { ParsedRoutePreview } from '@/types/travelRoutes'
import type { TransportMode } from '@/types/route'

export type TripTransport = 'car' | 'bike' | 'foot' | 'public' | 'mixed'
// #1491: маршрутизируемое подмножество не перечисляется руками, а берётся
// пересечением со списком режимов карты. Разъедутся таксономии — сломается
// компиляция, а не поведение планировщика.
export type RoutableTripTransport = Extract<TripTransport, TransportMode>
// Профили ORS cycling-regular/road/mountain: бэк принимает и отдаёт эти же ключи.
export type TripBikeType = 'regular' | 'road' | 'mountain'
export type TripVisibility = 'public' | 'followers' | 'private'
export type TripPlanStatus = 'planning' | 'active' | 'completed'
export type RoutePointType = 'place' | 'custom' | 'rest' | 'overnight'
export type TripRsvp = 'going' | 'maybe' | 'declined' | 'invited'
export type SuggestionStatus = 'pending' | 'approved' | 'rejected'

export interface TripPerson {
  id: number
  name: string
  avatarUrl: string | null
}

/**
 * #1843: данные брони ночёвки. Живут только у точки `overnight` — у остальных
 * типов поля не собираются формой, не уезжают в PUT маршрута и не читаются из
 * ответа. Раньше адрес жилья, ссылка на Booking и время заезда лежали одной
 * строкой в `description`, и вытащить оттуда отдельно ссылку было нечем.
 */
export interface OvernightBooking {
  /** Адрес жилья: отдельная строка, а не часть свободного описания. */
  address: string | null
  /** Абсолютный http(s)-адрес брони, нормализованный общим контрактом ссылок. */
  url: string | null
  /** Цена за ночь. Валюты в контракте нет — число показывается без символа. */
  price: number | null
  /** Время заезда в форме `ЧЧ:ММ`; секунды бэкенда сюда не доезжают. */
  checkinTime: string | null
}

export interface RoutePoint {
  id: string
  type: RoutePointType
  name: string
  description: string | null
  /** [lng, lat] in the Metravel domain format. */
  coordinates: [number, number] | null
  placeId: number | null
  /**
   * Бронь ночёвки (#1843). Поле необязательное: точки строятся литералами в
   * десятке мест (мок, шаблоны, импорт трека, предложения участников), и ни
   * одному из них бронь не принадлежит — `undefined` там честнее пустого
   * объекта. У точки не-`overnight` значение всегда отсутствует или `null`.
   */
  booking?: OvernightBooking | null
}

export interface RouteSummary {
  distanceKm: number
  durationMin: number
  elevationGainM: number
  stopsCount: number
  provider?: 'backend' | 'fallback' | 'ors' | 'direct' | string
  updatedAt?: string | null
}

export type RouteGeometry = [number, number][]

export interface RoutingState {
  provider: string
  isOptimal: boolean
  fallbackReason: string | null
  warnings: string[]
}

export type TripRouteSummaryStatus = 'ready' | 'degraded' | 'unavailable'

/**
 * Высотная часть кэшированной сводки маршрута (`/trips/{id}/route-summary/`).
 * Профиль появляется только у ORS-маршрута с 3D-полилинией: прямая линия
 * (`provider: 'direct'`) и `unavailable` высот не несут, и график для них скрыт.
 */
export interface TripRouteElevation {
  status: TripRouteSummaryStatus
  provider: string
  ascentM: number | null
  descentM: number | null
  /** Декодированная 3D-полилиния для переиспользуемого RouteElevationProfile. */
  preview: ParsedRoutePreview | null
  /** Та же полилиния как линия маршрута: пересчёт ORS обнуляет `route_geometry`. */
  geometry: RouteGeometry | null
  calculatedAt: string | null
}

export interface TripParticipant extends TripPerson {
  rsvp: TripRsvp
  role: 'organizer' | 'participant'
}

export interface TripReport {
  summary: string
  photoUrls: string[]
  gpxUrl: string | null
  visitedPlaceIds: number[]
  published: boolean
  publishedAt: string | null
}

export interface PlannedTrip {
  id: number
  slug: string
  title: string
  description: string
  startDate: string
  /** Календарный день конца, `YYYY-MM-DD`; null — конец не задан (#1838). */
  endDate: string | null
  startTime: string | null
  transport: TripTransport
  // null — бэк не отдал bike_type; выбор типа велосипеда в этом случае скрыт.
  bikeType: TripBikeType | null
  visibility: TripVisibility
  seatsTotal: number
  startPoint: RoutePoint | null
  status: TripPlanStatus
  organizer: TripPerson
  route: RoutePoint[]
  routeGeometry: RouteGeometry | null
  routeSummary: RouteSummary | null
  routingState: RoutingState | null
  participants: TripParticipant[]
  coverUrl: string | null
  region: string
  publishedToCommunity: boolean
  report: TripReport | null
  isOwner: boolean
  myRsvp: TripRsvp | null
  createdAt: string
}

export interface RouteTemplate {
  id: string
  title: string
  description: string
  transport: TripTransport
  points: Array<Omit<RoutePoint, 'id'>>
}

export interface TripSuggestion {
  id: number
  tripId: number
  author: TripPerson
  point: RoutePoint
  status: SuggestionStatus
  createdAt: string
}

export interface CommunityTripsFilters {
  transport?: TripTransport
  region?: string
  minDistanceKm?: number
  maxDistanceKm?: number
}

export interface CreateTripInput {
  title: string
  description: string
  startDate: string
  /** Необязательный день конца; null/пропуск — поездка на одну дату. */
  endDate?: string | null
  startTime: string | null
  transport: TripTransport
  visibility: TripVisibility
  seatsTotal: number
  startPoint: RoutePoint | null
  createTelegramGroup?: boolean
}

export interface UpdateTripInput {
  tripId: number
  title: string
  description: string
  startDate: string
  /** Обязателен явно: пропуск поля молча стирал бы уже сохранённый конец. */
  endDate: string | null
  startTime: string | null
  transport: TripTransport
  visibility: TripVisibility
  seatsTotal: number
  coverUrl: string | null
}

export interface UpdateTripTransportInput {
  tripId: number
  transport: RoutableTripTransport
}

export interface UpdateTripBikeTypeInput {
  tripId: number
  bikeType: TripBikeType
}

export interface UpdateRouteInput {
  tripId: number
  route: RoutePoint[]
}

export interface RsvpInput {
  tripId: number
  rsvp: TripRsvp
}

export interface InviteInput {
  tripId: number
  userIds: number[]
}

export interface SuggestPointInput {
  tripId: number
  point: Omit<RoutePoint, 'id'>
}

export interface DecideSuggestionInput {
  tripId: number
  suggestionId: number
  decision: 'approve' | 'reject'
}

export interface SubmitReportInput {
  tripId: number
  summary: string
  photoUrls: string[]
  gpxUrl: string | null
  visitedPlaceIds: number[]
  publishToCommunity: boolean
}
