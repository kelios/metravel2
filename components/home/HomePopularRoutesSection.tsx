import { fetchTravelsPopular } from '@/api/map'

import { HomeInspirationSection } from './HomeInspirationSection'
import { translate as i18nT } from '@/i18n'


const SEARCH_EMPTY_POPULAR_COUNT = 6

const fetchHomePopularTravels = (options?: { signal?: AbortSignal }) =>
  fetchTravelsPopular({ ...options, limit: 10 })

export default function HomePopularRoutesSection({
  enabled = true,
  surface = 'home',
}: {
  enabled?: boolean
  /** Where the rail is shown: the home page or the empty site search (#2895). */
  surface?: 'home' | 'search_empty'
}) {
  return (
    <HomeInspirationSection
      title={i18nT('home:components.home.HomePopularRoutesSection.populyarnoe_u_puteshestvennikov_77627476')}
      subtitle={i18nT('home:components.home.HomePopularRoutesSection.marshruty_kotorye_chasche_vsego_otkryvayut_d_dbaf2505')}
      queryKey="home-popular-travels"
      fetchFn={fetchHomePopularTravels}
      layout="rail"
      enabled={enabled}
      surface={surface}
      // Под пустым поиском — запасной вариант, а не подборка: 3–6 маршрутов (#2895).
      fixedCount={surface === 'search_empty' ? SEARCH_EMPTY_POPULAR_COUNT : undefined}
    />
  )
}
