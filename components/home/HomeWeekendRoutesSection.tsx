
import { fetchTravelsOfMonth } from '@/api/map'

import { HomeInspirationSection } from './HomeInspirationSection'

const fetchHomeTravelsOfMonth = (options?: { signal?: AbortSignal }) =>
  fetchTravelsOfMonth({ ...options, limit: 6 })

export default function HomeWeekendRoutesSection() {
  return (
    <HomeInspirationSection
      title="Идеи для ближайших выходных"
      subtitle="Реальные маршруты без долгого планирования"
      queryKey="home-travels-of-month"
      fetchFn={fetchHomeTravelsOfMonth}
    />
  )
}

