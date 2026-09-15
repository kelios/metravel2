// #1947 (IOS-06), семья NATIVE-TEXT-ROW-001. Мета-ряд карточки квеста
// («8 точек · ~2,5 ч · Средне») — вложенные `flexDirection: 'row'`, а сама
// карточка несёт `overflow: 'hidden'`. В RN `flexShrink` по умолчанию 0, поэтому
// группа, которая одна не помещается в строку (длинная локаль BE/PL/UK или
// системное увеличение шрифта), вылезала за карточку и обрезалась МОЛЧА: без
// многоточия, хвост значения просто исчезал. Тест держит sizing contract:
// единственный выход на сжатие в группе + явное многоточие у подписи, при этом
// разделитель сжиматься не имеет права.
import React from 'react'
import { StyleSheet } from 'react-native'
import { render, screen } from '@testing-library/react-native'

import { QuestForCityCard } from '@/components/quests/QuestForCityCard'

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
    default: (props: any) =>
      ReactRuntime.createElement(View, { ...props, testID: 'quest-card-media' }),
  }
})

const quest = {
  id: 'barkovshchina-spirits',
  title: 'Квест по Барковщине: озёра и легенды',
  points: 8,
  durationMin: 150,
  difficulty: 'medium',
  cityId: '7',
  cityName: 'Барковщина',
  lat: 55.18,
  lng: 28.6,
}

const renderCard = () => render(<QuestForCityCard quest={quest as any} />)

const flatten = (testID: string) =>
  StyleSheet.flatten(screen.getByTestId(testID).props.style) as Record<string, unknown>

describe('QuestForCityCard — мета-ряд при длинной подписи', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseBreakpoints.mockReturnValue({ isMobile: true, isPhone: true, isSmallPhone: false })
  })

  it('переносит мета-ряд и не задаёт ему фиксированной высоты', () => {
    renderCard()

    const row = flatten('quest-card-meta-row')

    expect(row.flexWrap).toBe('wrap')
    expect(row.height).toBeUndefined()
    expect(row.maxHeight).toBeUndefined()
  })

  it.each(['points', 'duration', 'difficulty'])(
    'даёт группе «%s» выход на сжатие внутри строки',
    (key) => {
      renderCard()

      const group = flatten(`quest-card-meta-${key}`)

      expect(group.flexShrink).toBe(1)
      expect(group.minWidth).toBe(0)
      expect(group.maxWidth).toBe('100%')
    },
  )

  it('оставляет подписи явное многоточие вместо тихой обрезки', () => {
    renderCard()

    const label = screen.getByTestId('quest-card-meta-points').findAllByType(
      require('react-native').Text,
    )
    const questLabel = label[label.length - 1]

    expect(questLabel.props.numberOfLines).toBe(1)
    expect(StyleSheet.flatten(questLabel.props.style).flexShrink).toBe(1)
  })
})
