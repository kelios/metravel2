type TravelAuthorSource = {
  userIds?: unknown
  userId?: unknown
  user?: { id?: unknown } | null
} | null | undefined

export function resolveTravelAuthorId(travel: TravelAuthorSource): number | null
export function travelAuthorProfilePath(travel: TravelAuthorSource): string | null
export function travelAuthorProfileUrl(travel: TravelAuthorSource): string | null
