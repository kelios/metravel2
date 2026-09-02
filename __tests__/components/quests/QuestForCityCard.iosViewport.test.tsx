// #1696: обложки квестов в секции «Квесты по этому городу и рядом» приехали
// пустыми в TestFlight-билд 1.0.5 (6). Слой отказа — общий native-гейт
// `richMediaViewport`: #1666 включила его на всём native и вывела из-под него
// только фото тела статьи, а плитка квеста осталась под гейтом, который на iOS
// не отдаёт кадру `visible` до следующего жеста скролла.
//
// Здесь провайдер и хук берутся настоящие — именно их платформенный контракт
// сломался. Мок хука (см. `QuestForCityCard.native-viewport.test.tsx`) такую
// регрессию пропускает: он проверяет реакцию карточки на `visible`, а не то,
// каким `visible` приходит на конкретной платформе.
import React from 'react'
import { render } from '@testing-library/react-native'
import { Animated, Platform } from 'react-native'

import { QuestForCityCard } from '@/components/quests/QuestForCityCard'
import { RichMediaViewportProvider } from '@/components/ui/richMediaViewport'

const mockImageCardMedia = jest.fn((props: any) => {
  const ReactRuntime = require('react')
  const { View } = require('react-native')
  return ReactRuntime.createElement(View, { ...props, testID: 'quest-card-media' })
})

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/hooks/useTrackedImpression', () => ({
  useTrackedImpression: () => ({ ref: { current: null }, onLayout: jest.fn() }),
}))

jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: (props: any) => mockImageCardMedia(props),
}))

const quest = {
  id: 'malbork-core',
  title: 'Квест по Мальборку',
  points: 6,
  cityId: '42',
  cityName: 'Мальборк',
  lat: 54.04,
  lng: 19.03,
  cover: 'https://metravel.by/quest-cover/malbork-core/cover.png',
}

function renderUnderProvider() {
  return render(
    <RichMediaViewportProvider scrollY={new Animated.Value(0)}>
      <QuestForCityCard quest={quest} />
    </RichMediaViewportProvider>,
  )
}

describe('QuestForCityCard под richMediaViewport по платформам', () => {
  const originalPlatform = Platform.OS

  afterEach(() => {
    ;(Platform as any).OS = originalPlatform
    mockImageCardMedia.mockClear()
  })

  it('на iOS отдаёт обложку сразу на первом кадре секции', () => {
    ;(Platform as any).OS = 'ios'

    const screen = renderUnderProvider()

    expect(screen.getByTestId('quest-card-media').props.source).toEqual({
      uri: quest.cover,
    })
  })

  it('на Android гейт продолжает придерживать обложку вне вьюпорта (#1035)', () => {
    ;(Platform as any).OS = 'android'

    const screen = renderUnderProvider()

    expect(screen.getByTestId('quest-card-media').props.source).toBeNull()
  })
})
