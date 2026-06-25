import { fetchTravelsPopular } from '@/api/map'

import { HomeInspirationSection } from './HomeInspirationSection'

const fetchHomePopularTravels = (options?: { signal?: AbortSignal }) =>
  fetchTravelsPopular({ ...options, limit: 10 })

export default function HomePopularRoutesSection() {
  return (
    <HomeInspirationSection
      title="Популярное у путешественников"
      subtitle="Маршруты, которые чаще всего открывают другие"
      queryKey="home-popular-travels"
      fetchFn={fetchHomePopularTravels}
      layout="rail"
    />
  )
}
