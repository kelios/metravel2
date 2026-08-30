/**
 * #1617: LegalPage (shared by /privacy, /terms, /disclaimer, /trip-rules,
 * /community-rules) rendered a hidden sr-only <h1> that reused `seoTitle`
 * (which carries a technical suffix meant for the <title> tag) while the
 * actual visible page heading (`pageTitle`, already documented as "H1" on
 * the prop) was plain unmarked text. Raw prod HTML confirmed the hidden
 * duplicate for /privacy on 2026-08-30 (curl, Googlebot UA).
 */
import { render } from '@testing-library/react-native'
import { Platform } from 'react-native'

import LegalPage from '@/components/legal/LegalPage'

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: true, isDesktop: false, isHydrated: true }),
}))
jest.mock('@/hooks/useSafeAreaInsetsSafe', () => ({
  useSafeAreaInsetsSafe: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('expo-router', () => ({
  usePathname: () => '/privacy',
  useIsFocused: () => true,
}))
jest.mock('@/components/seo/LazyInstantSEO', () => () => null)

describe('LegalPage single H1 (#1617)', () => {
  const originalOS = Platform.OS

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true })
  })

  it('exposes pageTitle as the single visible level-1 heading, not seoTitle', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })

    const { getByText, queryByText, UNSAFE_root } = render(
      <LegalPage
        headKey="privacy"
        seoTitle="Политика конфиденциальности и обработка данных | Metravel"
        seoDescription="d"
        pageTitle="Политика конфиденциальности"
        sections={[{ paragraphs: ['текст'] }]}
      />,
    )

    const heading = getByText('Политика конфиденциальности')
    expect(heading.props.accessibilityRole).toBe('header')
    expect(heading.props['aria-level']).toBe(1)

    // The old hidden duplicate must be gone entirely, not just re-hidden.
    expect(queryByText('Политика конфиденциальности и обработка данных | Metravel')).toBeNull()
    // react-test-renderer's findAllByProps can report the same logical Text
    // element twice (composite + host fiber) — dedupe by content, as in
    // about.test.tsx's equivalent single-H1 assertion.
    const level1 = new Set(
      UNSAFE_root
        .findAllByProps({ accessibilityRole: 'header' })
        .filter((node) => node.props['aria-level'] === 1)
        .map((node) => String(node.props.children)),
    )
    expect(Array.from(level1)).toEqual(['Политика конфиденциальности'])
  })
})
