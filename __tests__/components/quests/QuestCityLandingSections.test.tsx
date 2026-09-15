/**
 * #1569: то же содержание, что у краулера.
 *
 * Статический HTML посадочной города несёт заметки о местах, и после гидратации
 * их обязан показать экран. Текст, который видит только краулер, — это
 * клоакинг, поэтому здесь проверяется сам факт: модель прогулки доезжает до
 * разметки теми же предложениями, а без модели секции просто нет.
 */
import React from 'react'
import { render, screen } from '@testing-library/react-native'

import QuestCityLandingSections from '@/components/quests/QuestCityLandingSections'

jest.mock('expo-router', () => ({
  Link: ({ children }: { children?: React.ReactNode }) => children ?? null,
}))

jest.mock('@expo/vector-icons/Feather', () => () => null)

const CITY = {
  segment: 'rome',
  alias: 'rome',
  cityId: '121',
  cityIds: ['121'],
  legacyAliases: [],
  cityName: 'Рим',
  countryName: 'Италия',
  countryCode: 'it',
  lat: 41.89,
  lng: 12.49,
  quests: [
    {
      id: 'rome-forum',
      numericId: 1,
      title: 'Квест по Риму: Форум',
      points: 2,
      cityId: '121',
      lat: 41.89,
      lng: 12.49,
      durationMin: 120,
      ratingAvg: null,
      ratingCount: 0,
      completionsCount: 0,
      viewsCount: 0,
      isCompletedByMe: false,
      firstCompleter: null,
    },
  ],
} as never

const WALK = {
  places: [
    {
      questId: 'rome-forum',
      questTitle: 'Квест по Риму: Форум',
      pointIndex: 0,
      title: 'Капитолий',
      location: 'Площадь Микеланджело',
      sentences: ['Площадь перестроил Микеланджело, и это его единственный градостроительный проект.'],
      openingHours: 'вт–вс 09:30–19:30',
      ticketPrice: '16 евро',
    },
  ],
  otherPlaces: ['Римский форум'],
  routes: [
    {
      questId: 'rome-forum',
      title: 'Квест по Риму: Форум',
      pointCount: 2,
      optionalCount: 1,
      museumCount: 1,
      durationMin: 120,
      difficulty: 'easy',
      petFriendly: true,
      startLocation: 'Площадь Венеции',
      finishLocation: 'Улица Императорских форумов',
    },
  ],
}

describe('QuestCityLandingSections', () => {
  it('показывает заметки о местах и структуру маршрута теми же фразами, что и SSG', () => {
    render(<QuestCityLandingSections city={CITY} nearbyCities={[]} walk={WALK} />)

    expect(screen.getByTestId('quest-city-walk')).toBeTruthy()
    expect(screen.getByText('Что увидите по дороге: Рим')).toBeTruthy()
    expect(screen.getByText('Капитолий — Площадь Микеланджело')).toBeTruthy()
    expect(
      screen.getByText('Площадь перестроил Микеланджело, и это его единственный градостроительный проект.'),
    ).toBeTruthy()
    expect(screen.getByText('Часы работы: вт–вс 09:30–19:30')).toBeTruthy()
    expect(screen.getByText('Билет: 16 евро')).toBeTruthy()
    expect(screen.getByText('Ещё по дороге: Римский форум.')).toBeTruthy()

    expect(screen.getByTestId('quest-city-routes')).toBeTruthy()
    expect(
      screen.getByText(
        'Квест «Квест по Риму: Форум»: 2 точки, примерно 2 ч, сложность — лёгкая.' +
          ' По желанию — 1 точка: их можно пропустить.' +
          ' Старт — Площадь Венеции, финиш — Улица Императорских форумов.' +
          ' Музеев по дороге: 1 — часы работы лучше проверить заранее.' +
          ' Маршрут отмечен как подходящий для прогулки с собакой.',
      ),
    ).toBeTruthy()
  })

  it('не рисует пустых секций, пока бандлы квестов не загружены', () => {
    render(<QuestCityLandingSections city={CITY} nearbyCities={[]} walk={null} />)

    expect(screen.queryByTestId('quest-city-walk')).toBeNull()
    expect(screen.queryByTestId('quest-city-routes')).toBeNull()
    expect(screen.getByTestId('quest-city-overview')).toBeTruthy()
  })
})
