import type { ImmutableRequest } from 'expo-server'
import PublicUserProfileScreen from './[id].tsx'
import UserProfileLoaderScreen from '@/components/screens/profile/UserProfileLoaderScreen.web'

export { default as ErrorBoundary } from '@/components/ui/LoaderScreenErrorBoundary'

// #3237: серверный рендер профиля автора. Loader и metadata работают только на
// сервере; клиент loader не читает (`UserProfileLoaderScreen`), поэтому на
// статическом шаблоне `/user/[id].html` и при переходе внутри приложения экран
// работает как раньше. Маршрут на SSR включает бэк отдельным релизом.
export default function UserProfileRoute() {
  return process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR === 'true'
    ? <UserProfileLoaderScreen><PublicUserProfileScreen /></UserProfileLoaderScreen>
    : <PublicUserProfileScreen />
}

export async function loader(request: ImmutableRequest | undefined, params: Record<string, string | string[]>) {
  const { loadUserProfileRoute } = await import('@/components/screens/profile/userProfileRouteLoader')
  return loadUserProfileRoute(request, params)
}

export async function generateMetadata(request: ImmutableRequest | undefined, params: Record<string, string | string[]>) {
  const { loadUserProfileRoute } = await import('@/components/screens/profile/userProfileRouteLoader')
  const { routeMetadata, shellRouteMetadata } = await import('@/utils/seoRoutes/routeMetadata')
  const payload = await loadUserProfileRoute(request, params)
  if (!payload) return shellRouteMetadata()
  const { translate } = await import('@/i18n')
  const { profile } = payload
  return routeMetadata({
    // Те же строки, что у клиентского InstantSEO экрана (`[id].tsx`).
    title: `${profile.name} | Metravel`,
    description: translate('auth:app.tabs.user.id.profil_avtora_value1_na_metravel_471497a1', { value1: profile.name }),
    canonical: `/user/${profile.userId}`,
    image: profile.avatar,
    imageAlt: profile.name,
    ogType: 'website',
  })
}
