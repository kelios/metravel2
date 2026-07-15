import { fetchTravelsPopular } from '@/api/map'

import { HomeInspirationSection } from './HomeInspirationSection'
import { translate as i18nT } from '@/i18n'


const fetchHomePopularTravels = (options?: { signal?: AbortSignal }) =>
  fetchTravelsPopular({ ...options, limit: 10 })

export default function HomePopularRoutesSection() {
  return (
    <HomeInspirationSection
      title={i18nT('home:components.home.HomePopularRoutesSection.populyarnoe_u_puteshestvennikov_77627476')}
      subtitle={i18nT('home:components.home.HomePopularRoutesSection.marshruty_kotorye_chasche_vsego_otkryvayut_d_dbaf2505')}
      queryKey="home-popular-travels"
      fetchFn={fetchHomePopularTravels}
      layout="rail"
    />
  )
}
