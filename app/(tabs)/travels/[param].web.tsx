import type { ImmutableRequest } from 'expo-server'
import TravelDetailsContainer from '@/components/travel/details/TravelDetailsContainer'
import TravelLoaderScreen from '@/components/travel/details/TravelLoaderScreen.web'

export default function TravelDetailsScreen() {
  return process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR === 'true'
    ? <TravelLoaderScreen />
    : <TravelDetailsContainer />
}

export async function loader(request: ImmutableRequest | undefined, params: Record<string, string | string[]>) {
  const { loadTravelRoute } = await import('@/components/travel/details/travelRouteLoader')
  return loadTravelRoute(request, params)
}

export async function generateMetadata(request: ImmutableRequest | undefined, params: Record<string, string | string[]>) {
  const { loadTravelRoute } = await import('@/components/travel/details/travelRouteLoader')
  const { routeMetadata, shellRouteMetadata } = await import('@/utils/seoRoutes/routeMetadata')
  const payload = await loadTravelRoute(request, params)
  if (!payload) return shellRouteMetadata()
  const { getTravelDetailsSeoViewModel } = await import('@/components/travel/details/hooks/travelDetailsContainerViewModel')
  const seo = getTravelDetailsSeoViewModel(payload.travel, payload.routeKey)
  return routeMetadata({
    title: seo.readyTitle ?? payload.travel.name,
    description: seo.readyDesc ?? '',
    canonical: seo.canonicalUrl,
    image: seo.readyImage,
    imageAlt: payload.travel.name,
    ogType: 'article',
  })
}
