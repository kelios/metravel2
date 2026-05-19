import React from 'react'
import { render, screen } from '@testing-library/react-native'

import HomeRandomRoutesSection from '@/components/home/HomeRandomRoutesSection'

jest.mock('@/components/home/HomeInspirationSection', () => ({
  HomeInspirationSection: ({
    title,
    subtitle,
    queryKey,
  }: {
    title: string
    subtitle?: string
    queryKey: string
  }) => {
    const { Text, View } = require('react-native')

    return (
      <View>
        <Text>{title}</Text>
        {subtitle ? <Text>{subtitle}</Text> : null}
        <Text>{queryKey}</Text>
      </View>
    )
  },
}))

describe('HomeRandomRoutesSection', () => {
  it('renders a clearer random-trip heading without duplicated spontaneous copy', () => {
    render(<HomeRandomRoutesSection />)

    expect(screen.getByText('Куда поехать без долгих поисков')).toBeTruthy()
    expect(
      screen.getByText('Откройте случайный маршрут и выберите идею за минуту'),
    ).toBeTruthy()
    expect(screen.getByText('home-random-travels')).toBeTruthy()
    expect(screen.queryByText('Спонтанно')).toBeNull()
    expect(screen.queryByText('Не хотите')).toBeNull()
    expect(screen.queryByText('выбирать долго?')).toBeNull()
  })
})

