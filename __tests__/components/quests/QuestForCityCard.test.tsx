import React from 'react'
import { render } from '@testing-library/react-native'

import { QuestForCityCard } from '@/components/quests/QuestForCityCard'

const mockImageCardMedia = jest.fn((props: any) => {
  const React = require('react')
  const { View } = require('react-native')
  return React.createElement(View, { testID: 'quest-card-media', ...props })
})

jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: (props: any) => mockImageCardMedia(props),
}))

describe('QuestForCityCard', () => {
  beforeEach(() => {
    mockImageCardMedia.mockClear()
  })

  it('passes quest cover with stable web media geometry', () => {
    render(
      <QuestForCityCard
        quest={{
          id: 'krakow-dragon',
          title: 'Тайна Краковского дракона',
          points: 7,
          cityId: '1',
          cityName: 'Краков',
          lat: 50.06,
          lng: 19.94,
          durationMin: 120,
          difficulty: 'easy',
          cover: ' https://metravelprod.s3.amazonaws.com/quests/1/main/cover.png?sig=1 ',
        }}
      />,
    )

    expect(mockImageCardMedia).toHaveBeenCalledTimes(1)
    const props = mockImageCardMedia.mock.calls[0]?.[0]
    expect(props.source).toEqual({
      uri: 'https://metravelprod.s3.amazonaws.com/quests/1/main/cover.png?sig=1',
    })
    expect(props.width).toBe(132)
    expect(props.height).toBe(132)
    expect(props.fit).toBe('contain')
    expect(props.blurBackground).toBe(true)
    expect(props.allowCriticalWebBlur).toBe(true)
    expect(props.revealOnLoadOnly).toBe(true)
    expect(props.optimizeWeb).toBe(false)
    expect(props.loading).toBe('eager')
  })

  it('allows callers to defer non-critical quest covers', () => {
    render(
      <QuestForCityCard
        imageLoading="lazy"
        quest={{
          id: 'krakow-dragon',
          title: 'Тайна Краковского дракона',
          points: 7,
          cityId: '1',
          cityName: 'Краков',
          lat: 50.06,
          lng: 19.94,
          durationMin: 120,
          difficulty: 'easy',
          cover: 'https://metravelprod.s3.amazonaws.com/quests/1/main/cover.png?sig=1',
        }}
      />,
    )

    const props = mockImageCardMedia.mock.calls[0]?.[0]
    expect(props.loading).toBe('lazy')
  })

  it('shows the age category in the quest meta row', () => {
    const { getByText } = render(
      <QuestForCityCard
        quest={{
          id: 'vitebsk-teens',
          title: 'Город как галерея',
          points: 8,
          cityId: '13',
          cityName: 'Витебск',
          lat: 55.19,
          lng: 30.2,
          durationMin: 105,
          difficulty: 'medium',
          tags: ['teens', 'age-11-14'],
        }}
      />,
    )

    expect(getByText('11-14 лет')).toBeTruthy()
  })
})
