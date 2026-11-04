import { staticRouteMetadata } from '@/utils/seoRoutes/routeMetadata'

export { default } from '@/components/games/WalkGamesScreen'

export function generateMetadata() {
  return staticRouteMetadata('/games')
}
