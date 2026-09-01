// #1673: карточка квеста — горизонтальный ряд, где квадратная плитка 132 и
// стрелка 40 съедали ширину: на 390pt тексту оставалось 148px, и названия
// («Квест по Барковщине: озёра и легенды» и все соседи в блоке «Квесты по этому
// городу и рядом») требовали четырёх строк при лимите в две. На узкой колонке
// стрелка-декорация уходит, а заголовку разрешена третья строка; на широкой
// раскладка прежняя — стрелка на месте, лимит две строки.
import React from 'react'
import { render, screen } from '@testing-library/react-native'

import { QuestForCityCard } from '@/components/quests/QuestForCityCard'

const mockUseBreakpoints = jest.fn(() => ({ isMobile: true, isSmallPhone: false }))

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/hooks/useResponsive', () => ({
  useBreakpoints: () => mockUseBreakpoints(),
}))

jest.mock('@/hooks/useTrackedImpression', () => ({
  useTrackedImpression: () => ({ ref: { current: null }, onLayout: jest.fn() }),
}))

jest.mock('@/components/ui/richMediaViewport', () => ({
  useRichMediaVisibility: () => ({ ref: { current: null }, visible: true, onLayout: jest.fn() }),
}))

jest.mock('@/components/ui/ImageCardMedia', () => {
  const ReactRuntime = require('react')
  const { View } = require('react-native')
  return {
    __esModule: true,
    default: (props: any) => ReactRuntime.createElement(View, { ...props, testID: 'quest-card-media' }),
  }
})

const quest = {
  id: 'barkovshchina-spirits',
  title: 'Квест по Барковщине: озёра и легенды',
  points: 8,
  cityId: '7',
  cityName: 'Барковщина',
  lat: 55.18,
  lng: 28.6,
}

const renderCard = () => render(<QuestForCityCard quest={quest as any} />)

describe('QuestForCityCard — ширина колонки заголовка', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseBreakpoints.mockReturnValue({ isMobile: true, isSmallPhone: false })
  })

  it('на узкой колонке убирает стрелку и разрешает заголовку третью строку', () => {
    renderCard()

    expect(screen.queryByTestId('quest-card-arrow')).toBeNull()
    expect(screen.getByText(quest.title).props.numberOfLines).toBe(3)
  })

  // На 320pt под текст остаётся ~140px, и трёх строк этому названию не хватает.
  it('на самой узкой колонке даёт заголовку четвёртую строку', () => {
    mockUseBreakpoints.mockReturnValue({ isMobile: true, isSmallPhone: true })

    renderCard()

    expect(screen.queryByTestId('quest-card-arrow')).toBeNull()
    expect(screen.getByText(quest.title).props.numberOfLines).toBe(4)
  })

  it('на широкой колонке оставляет стрелку и лимит в две строки', () => {
    mockUseBreakpoints.mockReturnValue({ isMobile: false, isSmallPhone: false })

    renderCard()

    expect(screen.getByTestId('quest-card-arrow')).toBeTruthy()
    expect(screen.getByText(quest.title).props.numberOfLines).toBe(2)
  })
})
