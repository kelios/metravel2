
import { fetchTravelsOfMonth } from '@/api/map'

import { HomeInspirationSection } from './HomeInspirationSection'
import { translate as i18nT } from '@/i18n'


const fetchHomeTravelsOfMonth = (options?: { signal?: AbortSignal }) =>
  fetchTravelsOfMonth({ ...options, limit: 6 })

export default function HomeWeekendRoutesSection() {
  return (
    <HomeInspirationSection
      title={i18nT('home:components.home.HomeWeekendRoutesSection.idei_dlya_blizhayshih_vyhodnyh_7b2221c5')}
      subtitle={i18nT('home:components.home.HomeWeekendRoutesSection.realnye_marshruty_bez_dolgogo_planirovaniya_04e57a57')}
      queryKey="home-travels-of-month"
      fetchFn={fetchHomeTravelsOfMonth}
    />
  )
}

