import { within } from '@testing-library/react-native'
import { Suspense } from 'react';
import { render as renderTree, act } from '@testing-library/react-native'
import type { RenderResult } from '@testing-library/react-native'
import type { TestInstance } from 'test-renderer'

import { Platform, StyleSheet, useWindowDimensions } from 'react-native'
import { __testables } from '@/components/travel/details/TravelDetailsHero'

const mockSliderSpy: jest.Mock<any, any> = jest.fn((_props: any) => null)
const mockAuthorQuickLinkSpy: jest.Mock<any, any> = jest.fn(() => {
  const React = require('react')
  const { View } = require('react-native')
  return React.createElement(View, { testID: 'mock-travel-author-quick-link' })
})

jest.mock('@/components/travel/Slider', () => ({
  __esModule: true,
  default: (props: any) => mockSliderSpy(props),
}))

jest.mock('@/components/travel/details/TravelAuthorQuickLink', () => ({
  __esModule: true,
  default: (props: any) => mockAuthorQuickLinkSpy(props),
}))

jest.mock('@/components/travel/AuthorCard', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => ({
    addFavorite: jest.fn(),
    removeFavorite: jest.fn(),
    isFavorite: () => false,
  }),
}))

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false, userId: null }),
}))

jest.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ requireAuth: jest.fn() }),
}))

jest.mock('@/utils/toast', () => ({
  showToast: jest.fn(),
}))

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native')
  return {
    ...RN,
    useWindowDimensions: () => ({ width: 390, height: 1000 }),
  }
})

describe('TravelHeroSection mobile image fit', () => {
  beforeEach(() => {
    Platform.OS = 'ios'
    Platform.select = (obj: any) => obj.ios ?? obj.default
    mockSliderSpy.mockClear()
    mockAuthorQuickLinkSpy.mockClear()
  })

  it('keeps captions below the mobile media frame and follows the current slide', async () => {
    const travel: any = {
      id: 1,
      name: 'Mobile hero demo',
      gallery: [
        {
          url: 'https://cdn.example.com/img.jpg',
          width: 1200,
          height: 800,
          updated_at: '2025-01-01',
          id: 1,
          caption: 'First caption',
        },
        { id: 2, url: 'https://cdn.example.com/second.jpg', caption: 'Second caption' },
        { id: 3, url: 'https://cdn.example.com/third.jpg', caption: '   ' },
      ],
      travelAddress: [],
    }

    const anchors: any = {
      gallery: { current: null },
      video: { current: null },
      description: { current: null },
      recommendation: { current: null },
      plus: { current: null },
      minus: { current: null },
      map: { current: null },
      points: { current: null },
      near: { current: null },
      popular: { current: null },
      excursions: { current: null },
    }

    const renderHero = (heroTravel: any) => (
      <Suspense fallback={null}>
        <__testables.TravelHeroSection
          travel={heroTravel}
          anchors={anchors}
          isMobile
          renderSlider
          onFirstImageLoad={() => {}}
          sectionLinks={[]}
          onQuickJump={() => {}}
        />
      </Suspense>
    )
    let tree: RenderResult
    await act(async () => {
      tree = await renderTree(renderHero(travel))
      await Promise.resolve()
    })

    expect(mockSliderSpy.mock.calls.length).toBeGreaterThan(0)
    const lastProps = mockSliderSpy.mock.calls[mockSliderSpy.mock.calls.length - 1]?.[0]
    expect(lastProps).toBeTruthy()
    expect(lastProps.fit).toBe('contain')
    expect(lastProps.showCaption).toBe(false)
    const caption = within(tree!.container).getByTestId('slider-caption', { includeHiddenElements: true })
    const mediaFrame = within(tree!.container).getByTestId('travel-details-hero-slider-container', { includeHiddenElements: true })
    const isCaptionHost = (node: TestInstance) =>
      typeof node.type === 'string' && node.props.testID === 'slider-caption'
    expect(mediaFrame.queryAll(isCaptionHost, { includeSelf: true }).length).toBe(0)
    const hero = within(tree!.container).getByTestId('travel-details-hero', { includeHiddenElements: true })
    expect(hero.queryAll(isCaptionHost, { includeSelf: true }).length).toBe(1)
    expect(caption.queryAll(node => node.type === "Text", { includeSelf: true }).some(node => node.props.children === 'First caption')).toBe(true)
    await act(async () => { lastProps.onIndexChanged(1) })
    expect(tree!.container.queryAll(node => node.type === "Text", { includeSelf: true }).some(node => node.props.children === 'Second caption')).toBe(true)
    expect(tree!.container.queryAll(node => node.type === "Text", { includeSelf: true }).some(node => node.props.children === 'First caption')).toBe(false)
    await act(async () => { lastProps.onIndexChanged(2) })
    expect(tree!.container.queryAll(isCaptionHost, { includeSelf: true }).length).toBe(0)
    await act(async () => { await tree!.rerender(renderHero({ ...travel, id: 4 })) })
    expect(tree!.container.queryAll(node => node.type === "Text", { includeSelf: true }).some(node => node.props.children === 'First caption')).toBe(true)
    await act(async () => {
      mockSliderSpy.mock.calls[mockSliderSpy.mock.calls.length - 1][0].onIndexChanged(1)
    })
    await act(async () => { await tree!.rerender(renderHero(travel)) })
    expect(tree!.container.queryAll(node => node.type === "Text", { includeSelf: true }).some(node => node.props.children === 'First caption')).toBe(true)
    expect(tree!.container.queryAll(node => node.type === "Text", { includeSelf: true }).some(node => node.props.children === 'Second caption')).toBe(false)
  })

  it('keeps hero slider height aligned with the mobile loading shell on native', async () => {
    const travel: any = {
      id: 2,
      name: 'Tall mobile hero',
      gallery: [
        {
          url: 'https://cdn.example.com/img.jpg',
          width: 1200,
          height: 800,
          updated_at: '2025-01-01',
          id: 1,
        },
      ],
      travelAddress: [],
    }

    const anchors: any = {
      gallery: { current: null },
      video: { current: null },
      description: { current: null },
      recommendation: { current: null },
      plus: { current: null },
      minus: { current: null },
      map: { current: null },
      points: { current: null },
      near: { current: null },
      popular: { current: null },
      excursions: { current: null },
    }

    let tree: RenderResult
    await act(async () => {
      tree = await renderTree(
        <Suspense fallback={null}>
          <__testables.TravelHeroSection
            travel={travel}
            anchors={anchors}
            isMobile
            renderSlider
            onFirstImageLoad={() => {}}
            sectionLinks={[]}
            onQuickJump={() => {}}
          />
        </Suspense>,
      )
      await Promise.resolve()
    })

    const sliderContainer = within(tree!.container).getByTestId('travel-details-hero-slider-container', { includeHiddenElements: true })
    expect(sliderContainer).toBeTruthy()
    const flattenedStyle = StyleSheet.flatten(sliderContainer.props.style)
    const viewport = useWindowDimensions()
    expect(flattenedStyle.height).toBe(Math.max(260, Math.round(viewport.height * 0.7)))
  })

  it('renders the mobile author quick link below the hero slider container', async () => {
    const travel: any = {
      id: 3,
      name: 'Author below slider',
      userName: 'Мария Иванова',
      userIds: '42',
      gallery: [
        {
          url: 'https://cdn.example.com/img.jpg',
          width: 1200,
          height: 800,
          updated_at: '2025-01-01',
          id: 1,
        },
      ],
      travelAddress: [],
    }

    const anchors: any = {
      gallery: { current: null },
      video: { current: null },
      description: { current: null },
      recommendation: { current: null },
      plus: { current: null },
      minus: { current: null },
      map: { current: null },
      points: { current: null },
      near: { current: null },
      popular: { current: null },
      excursions: { current: null },
    }

    let tree: RenderResult
    await act(async () => {
      tree = await renderTree(
        <Suspense fallback={null}>
          <__testables.TravelHeroSection
            travel={travel}
            anchors={anchors}
            isMobile
            renderSlider
            onFirstImageLoad={() => {}}
            sectionLinks={[]}
            onQuickJump={() => {}}
          />
        </Suspense>,
      )
      await Promise.resolve()
    })

    const orderedNodes = tree!.container.queryAll((node) => {
      return (
        node.props.testID === 'travel-details-hero-slider-container' ||
        node.props.testID === 'mock-travel-author-quick-link'
      )
    }, { includeSelf: true })
    const orderedIds = orderedNodes.map((node) => node.props.testID)
    const firstSliderIndex = orderedIds.indexOf('travel-details-hero-slider-container')
    const firstAuthorIndex = orderedIds.indexOf('mock-travel-author-quick-link')

    expect(firstSliderIndex).toBeGreaterThanOrEqual(0)
    expect(firstAuthorIndex).toBeGreaterThan(firstSliderIndex)
    expect(mockAuthorQuickLinkSpy.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ travel }))
  })
})
