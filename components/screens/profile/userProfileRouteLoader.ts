import type { ImmutableRequest } from 'expo-server'
import { fetchPublicRouteJsonResponse, publicRouteError } from '@/utils/ssr/fetchPublicRouteJson'
import { memoizePublicRouteData, type PublicRouteRequest } from '@/utils/ssr/publicRouteData'
import { parsePublicUserId, projectPublicUserProfile, type PublicUserProfile } from '@/utils/publicUserProfile'

export type UserProfileLoaderPayload = { profile: PublicUserProfile } | null

/**
 * #3237: публичный профиль для серверного HTML (страница /user/<id> и
 * `author.sameAs` статьи); в пределах запроса — один GET на `user-profile:<id>`.
 * Нет профиля — 404; сбой API — 503. Без SSR-рантайма — `null`, и экран
 * работает как раньше (клиентский запрос профиля).
 */
export function fetchPublicUserProfile(request: PublicRouteRequest, userId: number): Promise<PublicUserProfile> {
  return memoizePublicRouteData(request, `user-profile:${userId}`, async () => {
    const response = await fetchPublicRouteJsonResponse(request, `user/${userId}/profile/`)
    if (response.status === 404 || response.status === 410) throw publicRouteError(404)
    if (!response.ok) throw publicRouteError(503)
    const profile = projectPublicUserProfile(response.data, userId)
    if (!profile) throw publicRouteError(404)
    return profile
  })
}

/** Читает из пути только `id`. */
export async function loadUserProfileRoute(
  request: ImmutableRequest | undefined,
  params: Record<string, string | string[]>,
): Promise<UserProfileLoaderPayload> {
  if (!request || process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR !== 'true') return null
  const userId = parsePublicUserId(params.id)
  if (userId === null) throw publicRouteError(404)
  return { profile: await fetchPublicUserProfile(request, userId) }
}
