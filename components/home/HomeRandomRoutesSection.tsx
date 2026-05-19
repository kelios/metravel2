import React from 'react'

import { fetchTravelsRandom } from '@/api/map'

import { HomeInspirationSection } from './HomeInspirationSection'

const fetchHomeRandomTravels = (options?: { signal?: AbortSignal }) =>
  fetchTravelsRandom({ ...options, limit: 3 })

export default function HomeRandomRoutesSection() {
  return (
    <HomeInspirationSection
      title="Куда поехать без долгих поисков"
      subtitle="Откройте случайный маршрут и выберите идею за минуту"
      queryKey="home-random-travels"
      fetchFn={fetchHomeRandomTravels}
      fixedCount={3}
      hideAuthor
    />
  )
}

