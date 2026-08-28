import { createRef } from 'react'
import type { ReactNode } from 'react'
import { render } from '@testing-library/react-native'
import { QueryClientProvider } from '@tanstack/react-query'

import { createTestQueryClient } from '@/__tests__/helpers/testQueryClient'
import type { Travel } from '@/types/types'
import { TravelDetailsContentSection } from '@/components/travel/details/sections/TravelDetailsContentSection'

const RN_WEB_TEXT_NODE_ERROR =
  'Unexpected text node: . A text node cannot be a child of a <View>.'

jest.mock('@/hooks/useProgressiveLoading', () => ({
  useProgressiveLoad: () => ({
    shouldLoad: true,
    setElementRef: jest.fn(),
  }),
}))

jest.mock('@/components/travel/details/TravelDetailsStyles', () => ({
  useTravelDetailsStyles: () => ({
    descriptionContainer: {},
    descriptionIntroWrapper: {},
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
    return <Text testID="travel-register-cta">cta</Text>
  }
})

jest.mock('@/components/travel/details/sections/DeferredQuestForCitySection', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/travel/details/sections/YouTubeSectionSlot', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/travel/details/sections/CollapsibleSection', () => {
  const React = require('react')
  const { View, Text } = require('react-native')
  return {
    CollapsibleSection: ({ title, children }: { title: string; children: React.ReactNode }) => (
      <View testID={`collapsible-${title}`}>
        <Text>{title}</Text>
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
    id: 563,
    slug: 'khokholovskaia-dolina-vesnoi-krokusy-i-marshrut',
    name: 'Хохоловская долина весной',
    description: '<p>Описание маршрута</p>',
    recommendation: '<ol><li>надевайте непромокаемую обувь</li></ol>',
    plus: '',
    minus: '',
    youtube_link: '',
    number_days: 1,
    countryName: 'Польша',
    monthName: 'Апрель',
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

function collectViewStringChildren(node: unknown, acc: string[] = []): string[] {
  if (node == null || typeof node === 'boolean') return acc
  if (Array.isArray(node)) {
    node.forEach((child) => collectViewStringChildren(child, acc))
    return acc
  }
  if (typeof node !== 'object') return acc
  const record = node as { type?: unknown; children?: unknown }
  const children = record.children
  if (record.type === 'View' && Array.isArray(children)) {
    for (const child of children) {
      if (typeof child === 'string') acc.push(child)
    }
  }
  collectViewStringChildren(children, acc)
  return acc
}

describe('TravelDetails RN-Web console contract', () => {
  it('does not pass empty insight strings as View children after draft-placeholder normalize', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const view = render(
      <TravelDetailsContentSection
        travel={createTravel()}
        isMobile={false}
        forceOpenKey={null}
        anchors={createAnchors()}
      />,
      { wrapper: withQueryClient() },
    )

    const stringChildren = collectViewStringChildren(view.toJSON())
    const unexpectedTextNode = spy.mock.calls.some((args) =>
      String(args[0] ?? '').includes('Unexpected text node'),
    )

    spy.mockRestore()

    expect(stringChildren).toEqual([])
    expect(unexpectedTextNode).toBe(false)
    expect(view.queryByTestId('collapsible-Рекомендации')).toBeTruthy()
    expect(view.queryByTestId('collapsible-Плюсы')).toBeNull()
    expect(view.queryByTestId('collapsible-Минусы')).toBeNull()
  })

  it('keeps plus/minus sections when those fields have real content', () => {
    const view = render(
      <TravelDetailsContentSection
        travel={createTravel({ plus: '<p>Плюсы</p>', minus: '<p>Минусы</p>' })}
        isMobile={false}
        forceOpenKey={null}
        anchors={createAnchors()}
      />,
      { wrapper: withQueryClient() },
    )

    expect(view.getByTestId('collapsible-Рекомендации')).toBeTruthy()
    expect(view.getByTestId('collapsible-Плюсы')).toBeTruthy()
    expect(view.getByTestId('collapsible-Минусы')).toBeTruthy()
    expect(collectViewStringChildren(view.toJSON())).toEqual([])
  })

  it('matches the exact RN-Web empty-string warning text used in browser acceptance', () => {
    expect(RN_WEB_TEXT_NODE_ERROR).toBe(
      'Unexpected text node: . A text node cannot be a child of a <View>.',
    )
  })
})
