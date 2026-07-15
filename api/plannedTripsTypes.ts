export type TripTransport = 'car' | 'bike' | 'foot' | 'public' | 'mixed'
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

export interface RoutePoint {
  id: string
  type: RoutePointType
  name: string
  description: string | null
  /** [lng, lat] in the Metravel domain format. */
  coordinates: [number, number] | null
  placeId: number | null
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
  startTime: string | null
  transport: TripTransport
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
  startTime: string | null
  transport: TripTransport
  visibility: TripVisibility
  seatsTotal: number
  coverUrl: string | null
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
