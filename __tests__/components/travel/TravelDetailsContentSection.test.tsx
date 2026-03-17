import { createRef } from 'react'
import { render, screen } from '@testing-library/react-native'

import type { Travel } from '@/types/types'
import { TravelDetailsContentSection } from '@/components/travel/details/sections/TravelDetailsContentSection'

let mockProgressiveShouldLoad = true

jest.mock('@/hooks/useProgressiveLoading', () => ({
  useProgressiveLoad: () => ({
    shouldLoad: mockProgressiveShouldLoad,
    setElementRef: jest.fn(),
  }),
}))

jest.mock('@/components/travel/details/TravelDetailsStyles', () => ({
  useTravelDetailsStyles: () => ({
    descriptionContainer: {},
    descriptionIntroWrapper: {},
    descriptionIntroTitle: {},
    descriptionIntroText: {},
    sectionContainer: {},
    contentStable: {},
    sectionHeaderText: {},
    sectionSubtitle: {},
    mobileInsightTabsWrapper: {},
    mobileInsightLabel: {},
    mobileInsightTabs: {},
    mobileInsightChip: {},
    mobileInsightChipActive: {},
    mobileInsightChipText: {},
    mobileInsightChipTextActive: {},
    mobileInsightChipBadge: {},
    mobileInsightChipBadgeActive: {},
  }),
}))

jest.mock('@/components/travel/TravelDescription', () => {
  const { Text } = require('react-native')
  return function MockTravelDescription(props: { title: string; htmlContent: string }) {
    return <Text testID={`travel-description-${props.title}`}>{props.htmlContent}</Text>
  }
})

jest.mock('@/components/travel/details/sections/LazyYouTubeSection', () => ({
  LazyYouTube: ({ url }: { url: string }) => {
    const { Text } = require('react-native')
    return <Text testID="lazy-youtube">{url}</Text>
  },
}))

jest.mock('@/components/travel/details/sections/CollapsibleSection', () => {
  const React = require('react')
  const { View, Text, Pressable } = require('react-native')

  return {
    CollapsibleSection: ({ title, open, onToggle, children }: any) => (
      <View testID={`collapsible-${title}`} data-open={open}>
        <Text>{title}</Text>
        {onToggle ? <Pressable testID={`toggle-${title}`} onPress={onToggle} /> : null}
        {children}
      </View>
    ),
  }
})

const createAnchors = () => ({
  gallery: createRef(),
  video: createRef(),
  description: createRef(),
  recommendation: createRef(),
  plus: createRef(),
  minus: createRef(),
  map: createRef(),
  points: createRef(),
  near: createRef(),
  popular: createRef(),
  excursions: createRef(),
  comments: createRef(),
})

const createTravel = (overrides: Partial<Travel> = {}) =>
  ({
    id: 1,
    slug: 'test-travel',
    name: 'Тестовый маршрут',
    description: '<p>Описание</p>',
    recommendation: '<p>Советы</p>',
    plus: '<p>Плюсы</p>',
    minus: '<p>Минусы</p>',
    youtube_link: 'https://youtube.com/watch?v=test',
    number_days: 2,
    countryName: 'Беларусь',
    monthName: 'Июль',
    travel_image_thumb_url: '',
    travel_image_thumb_small_url: '',
    ...overrides,
  }) as Travel

describe('TravelDetailsContentSection', () => {
  beforeEach(() => {
    mockProgressiveShouldLoad = true
  })

  it('renders description section for draft travel even when description is empty', () => {
    render(
      <TravelDetailsContentSection
        travel={createTravel({ description: '', publish: false as any })}
        isMobile={false}
        forceOpenKey={null}
        anchors={createAnchors()}
      />
    )

    expect(screen.getByTestId('travel-details-description')).toBeTruthy()
  })

  it('opens the forced mobile insight tab', () => {
    render(
      <TravelDetailsContentSection
        travel={createTravel()}
        isMobile
        forceOpenKey="minus"
        anchors={createAnchors()}
      />
    )

    expect(screen.getByText('Впечатления автора')).toBeTruthy()
    expect(screen.getByTestId('collapsible-Рекомендации').props['data-open']).toBe(false)
    expect(screen.getByTestId('collapsible-Плюсы').props['data-open']).toBe(false)
    expect(screen.getByTestId('collapsible-Минусы').props['data-open']).toBe(true)
  })

  it('shows lazy youtube only when progressive video loading is ready', () => {
    mockProgressiveShouldLoad = false
    const view = render(
      <TravelDetailsContentSection
        travel={createTravel()}
        isMobile={false}
        forceOpenKey={null}
        anchors={createAnchors()}
      />
    )

    expect(screen.queryByTestId('lazy-youtube')).toBeNull()

    mockProgressiveShouldLoad = true
    view.rerender(
      <TravelDetailsContentSection
        travel={createTravel()}
        isMobile={false}
        forceOpenKey={null}
        anchors={createAnchors()}
      />
    )

    expect(screen.getByTestId('lazy-youtube')).toBeTruthy()
  })
})
