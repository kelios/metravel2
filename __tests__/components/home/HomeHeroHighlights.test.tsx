import React from 'react'
import { StyleSheet } from 'react-native'
import { fireEvent, render } from '@testing-library/react-native'
import HomeHeroBookLayout from '@/components/home/HomeHeroBookLayout'
import {
  HERO_HIGHLIGHTS,
  resolveHeroHighlightGuestHref,
} from '@/components/home/homeHeroContent'
import { resolveAuthIntentGroup } from '@/utils/authIntentCopy'
import { resolvePostAuthPath } from '@/utils/authNavigation'

// #2901: плашки hero выглядят как чипы, поэтому каждая обязана быть ссылкой.
// Локальный Link пробрасывает `href` в ребёнка, как Slot у настоящего сливает стиль
// ребёнка спредом (функция стиля становится `{}`) и не переходит, если обработчик
// сделал `preventDefault`.
const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const React = require('react')
  return {
    useRouter: () => ({ push: mockPush }),
    Link: ({ children, href, onPress }: any) =>
      React.cloneElement(React.Children.only(children), {
        href,
        style: { ...React.Children.only(children).props.style },
        onPress: (event: any) => {
          onPress?.(event)
          if (!event.defaultPrevented) mockPush(href)
        },
      }),
  }
})
jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock('@/components/home/HomeHeroSearchBar', () => ({
  __esModule: true,
  default: () => null,
}))

// Маркер стиля карточки: доходит до хоста, только если стиль — плоский объект.
const heroStyles = new Proxy({}, {
  get: (_target, key) => (key === 'tabletFeatureCard' ? { borderWidth: 1 } : {}),
})

const slide = { source: { uri: 'https://example.test/a.jpg' }, alt: 'a', title: 'Озеро', subtitle: 'Италия' }

const renderTabletBook = (onHighlightPress = jest.fn()) =>
  render(
    <HomeHeroBookLayout
      colors={new Proxy({}, { get: () => '#000' }) as any}
      styles={heroStyles}
      isWeb
      isNarrowLayout
      isTabletLayout
      bookHeight={0}
      showSideSlider={false}
      width={1000}
      sliderHeight={300}
      sliderMediaWidth={400}
      sliderIconColor="#fff"
      disableHeroSliderBlur
      heroSubtitle="Реальные маршруты"
      moodCards={[]}
      heroHighlights={HERO_HIGHLIGHTS}
      bookImages={[slide]}
      currentSlide={slide}
      renderedSlideIndices={[0]}
      visibleSlide={0}
      loadedSlides={new Set<number>()}
      useStackedCtas={false}
      topWaveAnimatedStyle={{}}
      bottomWaveAnimatedStyle={{}}
      onQuickFilterPress={jest.fn()}
      onHighlightPress={onHighlightPress}
      onOpenArticle={jest.fn()}
      onOpenSearch={jest.fn()}
      onSearchSubmit={jest.fn()}
      isMobile={false}
      pendingAction={null}
      onPrevSlide={jest.fn()}
      onNextSlide={jest.fn()}
      onMarkSlideLoaded={jest.fn()}
    />,
  )

describe('HERO_HIGHLIGHTS (#2901)', () => {
  beforeEach(() => mockPush.mockClear())

  it('gives every highlight a unique id and an in-app route', () => {
    const ids = HERO_HIGHLIGHTS.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const item of HERO_HIGHLIGHTS) expect(item.route).toMatch(/^\/[a-z]/)
  })

  it('routes the highlights per the mock and hides GPS tracks until #2902', () => {
    expect(Object.fromEntries(HERO_HIGHLIGHTS.map((item) => [item.id, item.route]))).toEqual({
      'quick-pick': '/search',
      book: '/export',
      nearby: '/map?radius=60',
    })
  })

  it('sends a guest from the book to sign-in by intent and lets a member through', () => {
    const book = HERO_HIGHLIGHTS.find((item) => item.id === 'book')!
    const guestHref = resolveHeroHighlightGuestHref(book, false)
    expect(guestHref).toMatch(/^\/(login|registration)\?/)
    expect(guestHref).toContain(`intent=${book.authIntent}`)
    expect(guestHref).toContain(`redirect=${encodeURIComponent('/export')}`)
    // Экран входа говорит о книге, а после входа гость попадает туда же, куда ведёт ссылка.
    expect(resolveAuthIntentGroup(book.authIntent)).toBe('book')
    expect(resolvePostAuthPath({ redirect: book.route, intent: book.authIntent })).toBe(book.route)
    expect(resolveHeroHighlightGuestHref(book, true)).toBeNull()
    for (const item of HERO_HIGHLIGHTS.filter((entry) => !entry.authIntent)) {
      expect(resolveHeroHighlightGuestHref(item, false)).toBeNull()
    }
  })

  it('renders each highlight as a link with its route and reports the press', async () => {
    const onHighlightPress = jest.fn()
    const { getByTestId } = await renderTabletBook(onHighlightPress)
    for (const item of HERO_HIGHLIGHTS) {
      const card = getByTestId(`home-hero-highlight-${item.id}`)
      expect(card.props.accessibilityRole).toBe('link')
      expect(card.props.href).toBe(item.route)
      // Slot теряет функцию стиля — карточка обязана сохранить вёрстку (#2830).
      expect(StyleSheet.flatten(card.props.style)).toMatchObject({ borderWidth: 1 })
      await fireEvent.press(card, { defaultPrevented: false, preventDefault: jest.fn() })
      expect(onHighlightPress).toHaveBeenLastCalledWith(item, expect.anything())
      expect(mockPush).toHaveBeenLastCalledWith(item.route)
    }
  })
})
