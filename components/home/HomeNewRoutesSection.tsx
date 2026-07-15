import { fetchTravels } from '@/api/travelListQueries'

import { HomeInspirationSection } from './HomeInspirationSection'
import { translate as i18nT } from '@/i18n'


const fetchHomeNewTravels = (options?: { signal?: AbortSignal }) =>
  fetchTravels(0, 10, '', { sort: 'newest' }, { signal: options?.signal })

export default function HomeNewRoutesSection() {
  return (
    <HomeInspirationSection
      title={i18nT('home:components.home.HomeNewRoutesSection.novye_marshruty_04e175d7')}
      subtitle={i18nT('home:components.home.HomeNewRoutesSection.svezhie_idei_kotorye_tolko_chto_dobavili_v_k_46bc1707')}
      queryKey="home-new-travels"
      fetchFn={fetchHomeNewTravels}
      layout="rail"
    />
  )
}
