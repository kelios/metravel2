import fs from 'node:fs'
import path from 'node:path'

import type { Page, Route } from '@playwright/test'

import type { PlannedTripDto } from '@/api/plannedTripsNormalizers'
import type { UserProfileDto } from '@/api/user'

import { ensureAuthedStorageFallback, mockFakeAuthApis } from './auth'

const OWNER_ID = 1
// A real local cover keeps screenshot theme probes from mistaking an opaque
// white fixture stretched across the card for a white page underlay.
const IMAGE = `data:image/webp;base64,${fs.readFileSync(path.join(process.cwd(), 'assets/images/cover_bled.webp')).toString('base64')}`

const person = (id: number): UserProfileDto => ({
  id, user: id, first_name: id === OWNER_ID ? 'E2E' : `Автор ${id}`, last_name: 'Путешественник',
  avatar: null, youtube: '', instagram: '', twitter: '', vk: '',
  email_notify_comments: true, email_notify_messages: true, language: 'ru',
  rank_summary: {
    level: 1, title: 'Путешественник', total_points: 0, badges_count: 0,
    current_level_min_points: 0, next_level_min_points: 100,
    next_level_title: 'Исследователь', is_max_level: false, progress_ratio: 0, remaining_points: 100,
  },
})

const subscriptions = [person(2), person(3)]
const subscribers = [person(4), person(5), person(6)]
const travel = (id: number, publicationStatus: 'draft' | 'published', userId = OWNER_ID) => ({
  id, slug: `e2e-screen-budget-${id}`, url: `/travels/e2e-screen-budget-${id}`,
  name: `Прогулка по Беларуси ${id}`, description: '<p>Маршрут по паркам и историческим местам.</p>',
  userIds: String(userId), user: { id: userId, name: 'E2E Путешественник' },
  travel_image_thumb_url: IMAGE, travel_image_thumb_small_url: IMAGE,
  countryName: 'Беларусь', countryCode: 'BY', cityName: 'Минск',
  countries: [{ country_id: 1, title_ru: 'Беларусь' }],
  year: '2026', monthName: 'Май', number_days: 1,
  publication_status: publicationStatus, publication_format: 'full',
  publish: publicationStatus === 'published', moderation: publicationStatus === 'published',
  gallery: [], travelAddress: [], coordsMeTravel: [], countUnicIpView: '7',
  created_at: '2026-09-01T09:00:00Z', updated_at: '2026-09-01T09:00:00Z',
})

// A two-digit organized count must replace the pending slot: a zero-only
// fixture would conceal proportional-digit/count-width layout shifts.
const plannedTrips: PlannedTripDto[] = Array.from({ length: 15 }, (_, index) => {
  const ownerId = index < 12 ? OWNER_ID : 2
  return {
    id: 992100 + index, title: `Выходные у озера ${index + 1}`,
    description: 'Прогулка и знакомство с окрестностями.', status: 'planned',
    start_date: '2027-05-15T09:00:00', end_date: '2027-05-16',
    start_point_name: 'Минск', start_lat: 53.9, start_lng: 27.56,
    owner: { id: ownerId, username: 'E2E Путешественник', avatar: null },
    participants: [{ user: OWNER_ID, status: 'accepted' }],
    route: { points: [] }, transport_mode: 'car', max_participants: 4,
    is_public: false, cover_url: IMAGE, created_at: '2026-09-01T09:00:00Z',
  }
})

const applications = [0, 1].map((index) => ({
  id: 992300 + index, trip: 992112 + index, trip_title: `Выходные у озера ${13 + index}`,
  applicant: OWNER_ID, applicant_profile: { id: OWNER_ID, name: 'E2E Путешественник', avatar: null },
  message: 'Хочу присоединиться к прогулке.', status: index === 0 ? 'approved' : 'reviewing',
  created_at: '2026-09-02T09:00:00Z',
}))
const notifications = [{
  id: 992400, notification_type: 'application_status_changed',
  trip: 992112, trip_title: 'Выходные у озера 13', application: 992300,
  application_status: 'approved', is_read: false, created_at: '2026-09-02T10:00:00Z',
}]
const paginated = <T>(results: T[]) => ({ count: results.length, next: null, previous: null, results })
const fulfill = (route: Route, value: unknown) => route.fulfill({
  status: 200, contentType: 'application/json', body: JSON.stringify(value),
})

type BudgetAuthOptions = {
  emptyPublished?: boolean
  /** null models a route whose author has not supplied a duration yet. */
  profileTravelDurationDays?: number | null
  beforeTripListsResponse?: () => Promise<void>
}

/** Deterministic private reads for screen geometry; never logs in or writes to a backend. */
export async function prepareMobileScreenBudgetAuth(page: Page, options: BudgetAuthOptions = {}): Promise<void> {
  await mockFakeAuthApis(page)
  await ensureAuthedStorageFallback(page, { userId: String(OWNER_ID), userName: 'E2E Путешественник' })
  const ownTravels = [travel(992001, 'draft'), travel(992002, 'draft'),
    ...(options.emptyPublished ? [] : [travel(992003, 'published')])].map((item) => ({
      ...item,
      number_days: options.profileTravelDurationDays === undefined ? item.number_days : options.profileTravelDurationDays,
    }))
  const profile: UserProfileDto = {
    ...person(OWNER_ID),
    tab_counters: {
      travels: ownTravels.length, published: options.emptyPublished ? 0 : 1,
      drafts: 2, subscribers: subscribers.length, subscriptions: subscriptions.length,
    },
  }
  const reads = new Map<string, unknown>([
    [`/api/user/${OWNER_ID}/profile/`, profile],
    ['/api/user/subscriptions/', subscriptions], ['/api/user/subscribers/', subscribers],
    [`/api/user/${OWNER_ID}/favorite-travels/`, [travel(992010, 'published', 2)]],
    [`/api/user/${OWNER_ID}/history/`, [travel(992011, 'published', 3)]],
    [`/api/user/${OWNER_ID}/recommended-travels/`, []],
    [`/api/user/${OWNER_ID}/travel-statuses/`, []],
    ['/api/message-threads/unread-count/', { count: 0 }],
    ['/api/trips/planned/me/', plannedTrips],
    ['/api/trip-applications/', paginated(applications)],
    ['/api/trip-notifications/', paginated(notifications)],
    ['/api/user/me/telegram/', {
      telegram_username: null, telegram_user_id: null, telegram_verified: false, preferred_messenger: null,
    }],
    ['/api/user/privacy-settings/', {
      trips: 'all', routes: 'all', social: 'registered', achievements: 'all', visited_places: 'all',
    }],
    ['/api/user-points/', paginated([])], ['/api/user-points/routes/', { routes: [] }],
    ['/api/user-points/stats/', {
      total: 0, byColor: {}, byCategoryId: {},
      byStatus: { visited: 0, want_to_visit: 0, planning: 0, archived: 0 },
      visited: 0, toVisit: 0, totalDistance: 0, countriesVisited: 0, citiesVisited: 0,
    }],
  ])
  const tripListPaths = new Set(['/api/trips/planned/me/', '/api/trip-applications/', '/api/trip-notifications/'])
  await page.route((url) => reads.has(url.pathname), async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    const pathname = new URL(route.request().url()).pathname
    if (tripListPaths.has(pathname)) await options.beforeTripListsResponse?.()
    return fulfill(route, reads.get(pathname))
  })
  const authorIds = new Set([OWNER_ID, ...subscriptions.map((entry) => entry.user)])
  await page.route((url) => {
    if (url.pathname !== '/api/travels/') return false
    const where = JSON.parse(url.searchParams.get('where') || '{}') as { user_id?: unknown }
    return authorIds.has(Number(where.user_id))
  }, (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    const url = new URL(route.request().url())
    const where = JSON.parse(url.searchParams.get('where') || '{}') as {
      user_id: number | string; publication_status?: string[]; publish?: number; moderation?: number
    }
    let items = Number(where.user_id) === OWNER_ID ? ownTravels : [travel(992020 + Number(where.user_id), 'published', Number(where.user_id))]
    if (where.publication_status) items = items.filter((item) => where.publication_status!.includes(item.publication_status))
    if (where.publish != null) items = items.filter((item) => Number(item.publish) === where.publish)
    if (where.moderation != null) items = items.filter((item) => Number(item.moderation) === where.moderation)
    const perPage = Number(url.searchParams.get('perPage') || 20)
    const pageNumber = Number(url.searchParams.get('page') || 1)
    return fulfill(route, { total: items.length, data: items.slice((pageNumber - 1) * perPage, pageNumber * perPage) })
  })
}
