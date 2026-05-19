import React from 'react'

import { fetchTravelsRandom } from '@/api/map'

import { HomeInspirationSection } from './HomeInspirationSection'

const fetchHomeRandomTravels = (options?: { signal?: AbortSignal }) =>
  fetchTravelsRandom({ ...options, limit: 3 })

export default function HomeRandomRoutesSection() {
  return (
    <HomeInspirationSection
      title="Не хотите"
      titleAccent="выбирать долго?"
      subtitle="Откройте случайный маршрут для спонтанного выезда"
      queryKey="home-random-travels"
      fetchFn={fetchHomeRandomTravels}
      fixedCount={3}
      hideAuthor
    />
  )
}

