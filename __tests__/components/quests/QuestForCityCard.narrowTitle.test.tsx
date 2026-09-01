// #1673: карточка квеста — горизонтальный ряд, где квадратная плитка 132 и
// стрелка 40 съедали ширину: на 390pt тексту оставалось 148px, и названия
// («Квест по Барковщине: озёра и легенды» и все соседи в блоке «Квесты по этому
// городу и рядом») требовали четырёх строк при лимите в две. На узкой колонке
// стрелка-декорация уходит, а заголовку разрешены дополнительные строки; на
// широкой раскладка прежняя — стрелка на месте, лимит две строки.
//
// Второй заход после прод-приёмки: снятой стрелки не хватило — на 390pt колонка
// 202px и семнадцати названиям выдачи нужна четвёртая строка. Поэтому на
// телефоне (<480pt) плитка становится компактной, и тест держит обе половины
// фикса: сторону плитки и лимит строк.
import React from 'react'
import { render, screen } from '@testing-library/react-native'

import { QuestForCityCard } from '@/components/quests/QuestForCityCard'
import {
  QUEST_TILE_MEDIA_SIZE,
  QUEST_TILE_MEDIA_SIZE_COMPACT,
} from '@/components/quests/questCoverTileGeometry'

const mockUseBreakpoints = jest.fn(() => ({ isMobile: true, isPhone: true, isSmallPhone: false }))

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
    mockUseBreakpoints.mockReturnValue({ isMobile: true, isPhone: true, isSmallPhone: false })
  })

  it('на телефоне убирает стрелку, сжимает плитку и разрешает четвёртую строку', () => {
    renderCard()

    expect(screen.queryByTestId('quest-card-arrow')).toBeNull()
    expect(screen.getByTestId('quest-card-media').props.width).toBe(QUEST_TILE_MEDIA_SIZE_COMPACT)
    expect(screen.getByText(quest.title).props.numberOfLines).toBe(4)
  })

  // На 320pt компактная плитка оставляет тексту 168px — потолок выдачи там пять строк.
  it('на самой узкой колонке даёт заголовку пятую строку', () => {
    mockUseBreakpoints.mockReturnValue({ isMobile: true, isPhone: false, isSmallPhone: true })

    renderCard()

    expect(screen.queryByTestId('quest-card-arrow')).toBeNull()
    expect(screen.getByTestId('quest-card-media').props.width).toBe(QUEST_TILE_MEDIA_SIZE_COMPACT)
    expect(screen.getByText(quest.title).props.numberOfLines).toBe(5)
  })

  // 480–767pt: колонка уже шире самого длинного названия, плитка остаётся полной.
  it('на большом телефоне и планшете держит полную плитку', () => {
    mockUseBreakpoints.mockReturnValue({ isMobile: true, isPhone: false, isSmallPhone: false })

    renderCard()

    expect(screen.getByTestId('quest-card-media').props.width).toBe(QUEST_TILE_MEDIA_SIZE)
    expect(screen.getByText(quest.title).props.numberOfLines).toBe(3)
  })

  it('на широкой колонке оставляет стрелку и лимит в две строки', () => {
    mockUseBreakpoints.mockReturnValue({ isMobile: false, isPhone: false, isSmallPhone: false })

    renderCard()

    expect(screen.getByTestId('quest-card-arrow')).toBeTruthy()
    expect(screen.getByTestId('quest-card-media').props.width).toBe(QUEST_TILE_MEDIA_SIZE)
    expect(screen.getByText(quest.title).props.numberOfLines).toBe(2)
  })
})
