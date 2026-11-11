import type { ImmutableRequest } from 'expo-server'
import SearchScreen from './search.tsx'
import SearchCatalogLinksBoundary from '@/components/listTravel/SearchCatalogLinks.web'
import { searchCatalogPagePath } from '@/components/listTravel/searchCatalogPage'
import { staticRouteMetadata } from '@/utils/seoRoutes/routeMetadata'

export { default as ErrorBoundary } from '@/components/ui/LoaderScreenErrorBoundary'

// #3323: ссылки на статьи страницы каталога и постраничные адреса /search?page=N
// в серверном HTML. Loader и metadata работают только на сервере; клиент loader
// не читает (`SearchCatalogLinks.web`), поэтому на статическом /search и при
// переходе внутри приложения каталог работает как раньше. HTML /search на SSR
// переключает бэк отдельным релизом (#3279).
export default function SearchRoute() {
  return process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR === 'true'
    ? <SearchCatalogLinksBoundary><SearchScreen /></SearchCatalogLinksBoundary>
    : <SearchScreen />
}

export async function loader(request: ImmutableRequest | undefined) {
  const { loadSearchCatalogLinks } = await import('@/components/listTravel/searchCatalogLinksLoader')
  return loadSearchCatalogLinks(request)
}

export async function generateMetadata(request: ImmutableRequest | undefined) {
  const { loadSearchCatalogLinks } = await import('@/components/listTravel/searchCatalogLinksLoader')
  const payload = await loadSearchCatalogLinks(request)
  // Без данных (статика, фильтры, сбой API на первой странице) — прежний head /search.
  return staticRouteMetadata('/search', payload ? { canonical: searchCatalogPagePath(payload.page) } : {})
}
