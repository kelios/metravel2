import React from 'react'

import { fetchTravelsOfMonth } from '@/api/map'

import { HomeInspirationSection } from './HomeInspirationSection'

const fetchHomeTravelsOfMonth = (options?: { signal?: AbortSignal }) =>
  fetchTravelsOfMonth({ ...options, limit: 6 })

export default function HomeWeekendRoutesSection() {
  return (
    <HomeInspirationSection
      title="Маршруты на"
      titleAccent="ближайшие выходные"
      subtitle="Реальные поездки, которые можно успеть за 1-2 дня"
      queryKey="home-travels-of-month"
      fetchFn={fetchHomeTravelsOfMonth}
    />
  )
}

