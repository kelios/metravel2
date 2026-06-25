import { fetchTravels } from '@/api/travelListQueries'

import { HomeInspirationSection } from './HomeInspirationSection'

const fetchHomeNewTravels = (options?: { signal?: AbortSignal }) =>
  fetchTravels(0, 10, '', { sort: 'newest' }, { signal: options?.signal })

export default function HomeNewRoutesSection() {
  return (
    <HomeInspirationSection
      title="Новые маршруты"
      subtitle="Свежие идеи, которые только что добавили в каталог"
      queryKey="home-new-travels"
      fetchFn={fetchHomeNewTravels}
      layout="rail"
    />
  )
}
