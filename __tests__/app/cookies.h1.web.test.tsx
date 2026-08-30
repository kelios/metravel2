import { render } from '@testing-library/react-native'
import { Platform } from 'react-native'

// #1617: /cookies rendered zero <h1> tags (confirmed via raw prod HTML,
// 2026-08-30). The page already had a suffix-free heading string sitting
// right next to the SEO title; it just wasn't marked as a heading at all.
jest.mock('expo-router', () => ({
  usePathname: () => '/cookies',
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useIsFocused: () => true,
}))
jest.mock('@/components/seo/LazyInstantSEO', () => () => null)

// `app/(tabs)/cookies.tsx` reads Platform.OS into a module-level `isWeb`
// constant at import time (same pattern as app/(tabs)/index.tsx), so it must
// be loaded lazily after flipping Platform.OS, not via a static top-level
// import evaluated before this file's own setup runs.
function loadCookiesScreen() {
  (Platform as { OS: string }).OS = 'web'
  return require('@/app/(tabs)/cookies').default
}

describe('CookieSettingsScreen H1 (#1617)', () => {
  it('has exactly one visible level-1 heading with the suffix-free text', () => {
    const CookiesScreen = loadCookiesScreen()
    const { getByText } = render(<CookiesScreen />)

    const heading = getByText('Настройки cookies и аналитики')
    expect(heading.props.accessibilityRole).toBe('header')
    expect(heading.props['aria-level']).toBe(1)
  })
})
