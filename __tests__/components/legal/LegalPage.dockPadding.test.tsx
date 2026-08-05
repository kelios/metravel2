/**
 * #1277: контент юридических страниц скроллится под нижним доком, поэтому нижний
 * отступ обязан включать высоту таб-бара. Без этого последняя секция («Контакты»
 * на disclaimer/terms/privacy/trip-rules) физически недостижима: скролл упирается
 * в предел, а текст остаётся под доком.
 *
 * Регрессия закрывает обе стороны: под доком отступ увеличен, на desktop web —
 * нет, иначе внизу появится мёртвая полоса.
 */
import React from 'react'
import { Platform, ScrollView } from 'react-native'
import { render } from '@testing-library/react-native'

import LegalPage from '@/components/legal/LegalPage'
import { BOTTOM_DOCK_HEIGHT } from '@/components/layout/bottomDockModel'

const BASE_VERTICAL_PADDING = 24

let mockResponsive = { isMobile: true, isDesktop: false, isHydrated: true }
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockResponsive,
}))

let mockInsets = { top: 0, bottom: 0, left: 0, right: 0 }
jest.mock('@/hooks/useSafeAreaInsetsSafe', () => ({
  useSafeAreaInsetsSafe: () => mockInsets,
}))

jest.mock('expo-router', () => ({
  usePathname: () => '/disclaimer',
  useIsFocused: () => true,
}))

jest.mock('@/components/seo/LazyInstantSEO', () => () => null)

const renderPage = () =>
  render(
    <LegalPage
      headKey="disclaimer"
      seoTitle="t"
      seoDescription="d"
      pageTitle="Отказ от ответственности"
      sections={[{ heading: '6. Контакты', paragraphs: ['По вопросам, связанным…'] }]}
    />,
  )

const bottomPaddingOf = (tree: ReturnType<typeof renderPage>): number => {
  const scroll = tree.UNSAFE_getByType(ScrollView)
  const style = scroll.props.contentContainerStyle
  const flat = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style
  return flat?.paddingBottom
}

describe('LegalPage — нижний отступ под доком (#1277)', () => {
  const originalOS = Platform.OS

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true })
    mockResponsive = { isMobile: true, isDesktop: false, isHydrated: true }
    mockInsets = { top: 0, bottom: 0, left: 0, right: 0 }
  })

  it('на native добавляет высоту дока и safe-area — хвост секции не уходит под таб-бар', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true })
    mockInsets = { top: 0, bottom: 18, left: 0, right: 0 }

    expect(bottomPaddingOf(renderPage())).toBe(BASE_VERTICAL_PADDING + BOTTOM_DOCK_HEIGHT + 18)
  })

  it('на mobile web добавляет высоту дока, но не safe-area (там док фиксированной высоты)', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    mockResponsive = { isMobile: true, isDesktop: false, isHydrated: true }
    mockInsets = { top: 0, bottom: 18, left: 0, right: 0 }

    expect(bottomPaddingOf(renderPage())).toBe(BASE_VERTICAL_PADDING + BOTTOM_DOCK_HEIGHT)
  })

  it('на desktop web дока нет — отступ остаётся базовым, мёртвой полосы внизу не появляется', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    mockResponsive = { isMobile: false, isDesktop: true, isHydrated: true }

    expect(bottomPaddingOf(renderPage())).toBe(BASE_VERTICAL_PADDING)
  })
})
