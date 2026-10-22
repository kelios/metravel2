import { createRef } from 'react'
import type { ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react-native'
import { QueryClientProvider } from '@tanstack/react-query'

import { createTestQueryClient } from '@/__tests__/helpers/testQueryClient'
import type { Travel } from '@/types/types'
import { TravelDetailsContentSection } from '@/components/travel/details/sections/TravelDetailsContentSection'
import { TravelDetailsDeferredTransition } from '@/components/travel/details/TravelDetailsDeferredTransition'

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
  }),
}))

jest.mock('@/components/travel/TravelDescription', () => {
  const { Text } = require('react-native')
  return function MockTravelDescription(props: { title: string; htmlContent: string }) {
    return <Text testID={`travel-description-${props.title}`}>{props.htmlContent}</Text>
  }
})

jest.mock('@/components/travel/details/sections/TravelRegisterCtaSection', () => {
  const { Text } = require('react-native')
  return function MockTravelRegisterCtaSection() {
    return <Text testID="travel-register-cta">Сохранить маршрут</Text>
  }
})

jest.mock('@/components/travel/details/sections/TravelArticleShareTripCta', () => {
  const { Text } = require('react-native')
  return function MockTravelArticleShareTripCta() {
    return <Text testID="travel-article-share-trip">Поделиться поездкой</Text>
  }
})

jest.mock('@/components/travel/details/sections/TravelPeerBadgePrompt', () => {
  const { Text } = require('react-native')
  return function MockTravelPeerBadgePrompt({ hasArticleText }: { hasArticleText: boolean }) {
    return hasArticleText ? <Text testID="travel-peer-badge-prompt">Наградить автора</Text> : null
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
    youtube_link: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
    number_days: 2,
    countryName: 'Беларусь',
    monthName: 'Июль',
    travel_image_thumb_url: '',
    travel_image_thumb_small_url: '',
    ...overrides,
  }) as Travel

const withQueryClient = () => {
  const queryClient = createTestQueryClient()
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return Wrapper
}

describe('TravelDetailsContentSection', () => {
  beforeEach(() => {
    mockProgressiveShouldLoad = true
  })

  it('places one share invitation after the existing save CTA and before the article body', () => {
    const view = render(
      <TravelDetailsContentSection
        travel={createTravel()}
        isMobile
        forceOpenKey={null}
        anchors={createAnchors()}
      />,
      { wrapper: withQueryClient() },
    )

    expect(screen.getAllByTestId('travel-article-share-trip')).toHaveLength(1)
    const content = JSON.stringify(view.toJSON())
    expect(content.indexOf('travel-register-cta')).toBeLessThan(content.indexOf('travel-article-share-trip'))
    expect(content.indexOf('travel-article-share-trip')).toBeLessThan(content.indexOf('travel-description-Тестовый маршрут'))
    expect(content.indexOf('travel-description-Тестовый маршрут')).toBeLessThan(content.indexOf('travel-peer-badge-prompt'))
    expect(content.indexOf('travel-peer-badge-prompt')).toBeLessThan(content.indexOf('lazy-youtube'))
    expect(screen.getByTestId('travel-details-description').findAllByProps({ testID: 'travel-peer-badge-prompt' })).toHaveLength(0)
  })

  it('retains the share invitation when the published article has no description section', () => {
    render(
      <TravelDetailsContentSection
        travel={createTravel({ description: '', publish: true, moderation: true })}
        isMobile={false}
        forceOpenKey={null}
        anchors={createAnchors()}
      />,
      { wrapper: withQueryClient() },
    )

    expect(screen.queryByTestId('travel-details-description')).toBeNull()
    expect(screen.queryByTestId('travel-register-cta')).toBeNull()
    expect(screen.getAllByTestId('travel-article-share-trip')).toHaveLength(1)
    expect(screen.queryByTestId('travel-peer-badge-prompt')).toBeNull()
  })

  it('renders canonical-only article text before the award invitation', () => {
    const view = render(
      <TravelDetailsContentSection
        travel={createTravel({ description: '', rich_text: { description: { safe_html: '<p>Canonical article</p>', plain_text: 'Canonical article' } } })}
        isMobile={false}
        forceOpenKey={null}
        anchors={createAnchors()}
      />,
      { wrapper: withQueryClient() },
    )
    expect(screen.getByTestId('travel-description-Тестовый маршрут').props.children).toBe('<p>Canonical article</p>')
    const content = JSON.stringify(view.toJSON())
    expect(content.indexOf('travel-description-Тестовый маршрут')).toBeLessThan(content.indexOf('travel-peer-badge-prompt'))
  })

  it.each(['<p><br></p>', '<p>&nbsp; &#160;</p>', ''])('does not invite an award for empty article markup %s', description => {
    render(
      <TravelDetailsContentSection
        travel={createTravel({ description, publish: true, moderation: true })}
        isMobile={false}
        forceOpenKey={null}
        anchors={createAnchors()}
      />,
      { wrapper: withQueryClient() },
    )
    if (description.trim()) expect(screen.getByTestId('travel-details-description')).toBeTruthy()
    else expect(screen.queryByTestId('travel-details-description')).toBeNull()
    expect(screen.queryByTestId('travel-peer-badge-prompt')).toBeNull()
  })

  it('preserves media-only article content without treating it as awardable article text', () => {
    const description = '<p><img src="https://example.com/article-photo.jpg" alt="Trip" /></p>'
    render(
      <TravelDetailsContentSection
        travel={createTravel({ description, publish: true, moderation: true })}
        isMobile={false}
        forceOpenKey={null}
        anchors={createAnchors()}
      />,
      { wrapper: withQueryClient() },
    )
    expect(screen.getByTestId('travel-description-Тестовый маршрут').props.children).toBe(description)
    expect(screen.queryByTestId('travel-peer-badge-prompt')).toBeNull()
  })

  it('renders description section for draft travel even when description is empty', () => {
    render(
      <TravelDetailsContentSection
        travel={createTravel({ description: '', publish: false as any })}
        isMobile={false}
        forceOpenKey={null}
        anchors={createAnchors()}
      />,
      { wrapper: withQueryClient() }
    )

    expect(screen.getByTestId('travel-details-description')).toBeTruthy()
    expect(screen.UNSAFE_getByType(TravelDetailsDeferredTransition).props).toMatchObject({
      testID: 'travel-details-quest-transition',
      allowEmptyRuntime: true,
      runtimeFrameReady: true,
      pending: false,
    })
  })

  it('opens the forced mobile insight tab', () => {
    render(
      <TravelDetailsContentSection
        travel={createTravel()}
        isMobile
        forceOpenKey="minus"
        anchors={createAnchors()}
      />,
      { wrapper: withQueryClient() }
    )

    expect(screen.getByText('Впечатления автора')).toBeTruthy()
    expect(screen.getByTestId('collapsible-Рекомендации').props['data-open']).toBe(false)
    expect(screen.getByTestId('collapsible-Плюсы').props['data-open']).toBe(false)
    expect(screen.getByTestId('collapsible-Минусы').props['data-open']).toBe(true)
  })

  it('shows lazy youtube only when progressive video loading is ready', async () => {
    mockProgressiveShouldLoad = false
    const view = render(
      <TravelDetailsContentSection
        travel={createTravel()}
        isMobile={false}
        forceOpenKey={null}
        anchors={createAnchors()}
      />,
      { wrapper: withQueryClient() }
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

    await waitFor(() => {
      expect(screen.getByTestId('lazy-youtube')).toBeTruthy()
    })
  })
})
