import AppStatsScreen from '@/components/admin/appStats/AppStatsScreen'
import { staticRouteMetadata } from '@/utils/seoRoutes/routeMetadata'

export default function AppStatsRoute() {
  return <AppStatsScreen />
}

export function generateMetadata() {
  return staticRouteMetadata('/app-stats')
}
