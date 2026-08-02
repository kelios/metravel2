// api/authorEngagement.ts
// Детализация «кто и какой маршрут» для карточек статистики автора (#1192).
//
// КОНТРАКТ (BE #1191, задеплоен 2026-08-02):
//   GET /travels/author-engagement/?metric=favorites|wishlist|visited|planned&page=1&perPage=20
//   Автор всегда = аутентифицированный пользователь; author_id/user_id в query → 400.
//   Ответ — стандартный конверт пагинации:
//     { total, count, current_page, per_page, next, results: [item] }
//   item: {
//     id: "<metric>:<pk>", metric, occurred_at, identity_hidden,
//     user: { id, first_name, last_name, avatar },
//     travel: { id, name, slug, url, travel_image_thumb_url }
//   }
//   identity_hidden=true отдаёт пустого пользователя (взаимная блокировка) — это
//   не ошибка, а отдельное состояние строки.

import { apiClient } from '@/api/client'
import { LONG_TIMEOUT } from '@/api/apiConfig'
import { unwrapPaginated } from '@/api/clientResponse'

export const AUTHOR_ENGAGEMENT_METRICS = ['favorites', 'wishlist', 'visited', 'planned'] as const

export type AuthorEngagementMetric = (typeof AUTHOR_ENGAGEMENT_METRICS)[number]

/** Ключи метрик профиля (`TravelEngagementStats`) → метрики API. */
const METRIC_BY_SUMMARY_KEY: Record<string, AuthorEngagementMetric> = {
  favoritesCount: 'favorites',
  wishlistCount: 'wishlist',
  visitedCount: 'visited',
  plannedCount: 'planned',
}

export const resolveAuthorEngagementMetric = (
  summaryKey: string | null | undefined,
): AuthorEngagementMetric | null =>
  (summaryKey && METRIC_BY_SUMMARY_KEY[summaryKey]) || null

export interface AuthorEngagementUser {
  id: number | null
  firstName: string
  lastName: string
  avatar: string | null
}

export interface AuthorEngagementTravel {
  id: number | null
  name: string
  slug: string
  url: string
  imageUrl: string
}

export interface AuthorEngagementItem {
  id: string
  metric: AuthorEngagementMetric
  occurredAt: string | null
  identityHidden: boolean
  user: AuthorEngagementUser
  travel: AuthorEngagementTravel
}

export interface AuthorEngagementPage {
  items: AuthorEngagementItem[]
  total: number
  page: number
  nextPage: number | null
}

export const AUTHOR_ENGAGEMENT_PAGE_SIZE = 20

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const asTrimmedString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : ''

const asPositiveId = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null
}

const asIsoDate = (value: unknown): string | null => {
  const raw = asTrimmedString(value)
  if (!raw) return null
  return Number.isNaN(new Date(raw).getTime()) ? null : raw
}

export const normalizeAuthorEngagementItem = (
  raw: unknown,
  metric: AuthorEngagementMetric,
  index: number,
): AuthorEngagementItem => {
  const record = asRecord(raw)
  const user = asRecord(record.user)
  const travel = asRecord(record.travel)
  const identityHidden = record.identity_hidden === true
  const userId = identityHidden ? null : asPositiveId(user.id)

  return {
    id: asTrimmedString(record.id) || `${metric}:${index}`,
    metric,
    occurredAt: asIsoDate(record.occurred_at),
    identityHidden,
    user: {
      id: userId,
      firstName: identityHidden ? '' : asTrimmedString(user.first_name),
      lastName: identityHidden ? '' : asTrimmedString(user.last_name),
      avatar: identityHidden ? null : asTrimmedString(user.avatar) || null,
    },
    travel: {
      id: asPositiveId(travel.id),
      name: asTrimmedString(travel.name),
      slug: asTrimmedString(travel.slug),
      url: asTrimmedString(travel.url),
      imageUrl: asTrimmedString(travel.travel_image_thumb_url),
    },
  }
}

export const normalizeAuthorEngagementPage = (
  payload: unknown,
  metric: AuthorEngagementMetric,
  page: number,
): AuthorEngagementPage => {
  const { items, total } = unwrapPaginated(payload)
  const normalized = items.map((item, index) =>
    normalizeAuthorEngagementItem(item, metric, (page - 1) * AUTHOR_ENGAGEMENT_PAGE_SIZE + index),
  )
  const hasNext = Boolean(asTrimmedString(asRecord(payload).next)) ||
    page * AUTHOR_ENGAGEMENT_PAGE_SIZE < total

  return {
    items: normalized,
    total,
    page,
    nextPage: normalized.length > 0 && hasNext ? page + 1 : null,
  }
}

export const fetchAuthorEngagementDetails = async (
  metric: AuthorEngagementMetric,
  page = 1,
): Promise<AuthorEngagementPage> => {
  const query = new URLSearchParams({
    metric,
    page: String(page),
    perPage: String(AUTHOR_ENGAGEMENT_PAGE_SIZE),
  }).toString()

  const payload = await apiClient.get<unknown>(
    `/travels/author-engagement/?${query}`,
    LONG_TIMEOUT,
  )
  return normalizeAuthorEngagementPage(payload, metric, page)
}
