import type { Travel, TravelPublicationStatus } from '@/types/types'

type TravelDraftFields = Pick<Travel, 'publication_status' | 'publish'>

// These statuses also back the profile list and server counter filters.
export const DRAFT_PUBLICATION_STATUSES = ['draft', 'pending_review'] as const
export const PUBLISHED_PUBLICATION_STATUSES = ['approved', 'published'] as const

const isFalseFlag = (value: unknown) =>
  value === false ||
  value === 0 ||
  value === '0' ||
  String(value).toLowerCase() === 'false'

export const isTravelDraft = (travel: TravelDraftFields): boolean => {
  const status = String(travel.publication_status ?? '').trim().toLowerCase()
  if ((DRAFT_PUBLICATION_STATUSES as readonly string[]).includes(status)) return true
  if ((PUBLISHED_PUBLICATION_STATUSES as readonly string[]).includes(status)) return false
  return isFalseFlag(travel.publish)
}

export type TravelPublicationFields = {
  publication_status?: string | null
  publish?: unknown
  moderation?: unknown
}

const PUBLICATION_STATUSES: readonly TravelPublicationStatus[] = [
  'draft', 'pending_review', 'approved', 'published',
]

const isTrueFlag = (value: unknown): boolean =>
  value === true || value === 1 || value === '1' || value === 'true'

/** Canonical values are authoritative, including invalid values. Only absence permits legacy fallback. */
export function resolveTravelPublicationStatus(travel: TravelPublicationFields): TravelPublicationStatus | null {
  if (travel.publication_status !== undefined) {
    return PUBLICATION_STATUSES.includes(travel.publication_status as TravelPublicationStatus)
      ? travel.publication_status as TravelPublicationStatus
      : null
  }
  const publish = isTrueFlag(travel.publish)
  const moderation = isTrueFlag(travel.moderation)
  if (publish) return moderation ? 'published' : 'pending_review'
  return moderation ? 'approved' : 'draft'
}
