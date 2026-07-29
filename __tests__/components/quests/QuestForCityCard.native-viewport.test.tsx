import React from 'react'
import { render } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { QuestForCityCard } from '@/components/quests/QuestForCityCard'

let mockVisible = false
const mockOnLayout = jest.fn()
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

jest.mock('@/components/ui/richMediaViewport', () => ({
  useRichMediaVisibility: () => ({
    ref: { current: null },
    visible: mockVisible,
    onLayout: mockOnLayout,
  }),
}))

jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: (props: any) => mockImageCardMedia(props),
}))

describe('QuestForCityCard native viewport media gate', () => {
  const originalPlatform = Platform.OS
  const quest = {
    id: 'krakow-dragon',
    title: 'Quest',
    points: 7,
    cityId: '1',
    cityName: 'Krakow',
    lat: 50.06,
    lng: 19.94,
    cover: 'https://metravel.by/quest-cover/krakow-dragon/cover.png',
  }

  beforeEach(() => {
    ;(Platform as any).OS = 'android'
    mockVisible = false
    mockOnLayout.mockClear()
    mockImageCardMedia.mockClear()
  })

  afterAll(() => {
    ;(Platform as any).OS = originalPlatform
  })

  it('withholds the cover URL until the card nears the native viewport', () => {
    const screen = render(<QuestForCityCard quest={quest} />)

    expect(screen.getByTestId('quest-card-media').props.source).toBeNull()
    const viewport = screen.getByTestId('quest-card-media-viewport-krakow-dragon')
    expect(viewport.props.collapsable).toBe(false)
    expect(viewport.props.onLayout).toBe(mockOnLayout)

    mockVisible = true
    screen.rerender(<QuestForCityCard quest={{ ...quest }} />)

    expect(screen.getByTestId('quest-card-media').props.source).toEqual({
      uri: quest.cover,
    })
  })
})
