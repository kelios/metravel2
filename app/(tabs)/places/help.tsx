import PlaceRequestsScreen from '@/components/places/PlaceRequestsScreen'
import { NotFoundContent } from '@/components/screens/NotFoundContent'
import { translate } from '@/i18n'
import { PLACE_REQUESTS_PATH } from '@/utils/placeRequestCreateIntent'
import { isPlaceRequestsPilotEnabled } from '@/utils/placeRequestsConfig'
import { notFoundRouteMetadata, routeMetadata } from '@/utils/seoRoutes/routeMetadata'

export default function PlacesHelpRoute() {
  return isPlaceRequestsPilotEnabled() ? <PlaceRequestsScreen /> : <NotFoundContent />
}

export function generateMetadata() {
  return isPlaceRequestsPilotEnabled() ? routeMetadata({
    title: translate('places:contributions.seoTitle'),
    description: translate('places:contributions.seoDescription'),
    canonical: PLACE_REQUESTS_PATH,
    robots: 'noindex, follow',
  }) : notFoundRouteMetadata()
}
