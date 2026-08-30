import { render, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'

// #1609: the home screen's single semantic <h1> is HomeHeroBookLayout's
// visible hero title (accessibilityRole="header" + aria-level=1, which
// react-native-web resolves to a real <h1> tag at runtime). The SSG static
// export separately injects a hidden `<h1 data-ssg-travel-h1>` sibling of
// #root for no-JS crawlers (scripts/generate-seo-pages.js `injectHiddenH1`);
// hydration never touches that sibling on its own, so HomeScreen must tear
// it down once the real content mounts — mirroring
// TravelDetailsCriticalShell's teardown of the same shared marker.
//
// `app/(tabs)/index.tsx` reads `Platform.OS` into a module-level `IS_WEB`
// constant at import time, so Platform.OS must already be 'web' *before*
// that module is first evaluated. A static top-level `import` would run
// before any test/beforeEach code, so it's loaded lazily via `require()`
// after flipping Platform.OS instead (jest-expo's `react-native` resolution
// isn't intercepted by `jest.mock('react-native', factory)` here — the
// factory never runs — so plain `Platform.OS` mutation, as already used
// elsewhere in this suite, e.g. QuestsContentPanel.test.tsx, is the
// reliable option). `jest.resetModules()` is deliberately avoided: it would
// also evict the already-loaded `react`/`react-test-renderer` singletons and
// break hook dispatch with a "more than one copy of React" error.
jest.mock('@/components/home/Home', () => () => null)
jest.mock('@/components/seo/LazyInstantSEO', () => () => null)
jest.mock('@/components/home/HomePageSkeleton', () => ({
  HomePageSkeleton: () => null,
}))

function loadHomeScreen() {
  (Platform as { OS: string }).OS = 'web'
  return require('@/app/(tabs)/index').default
}

describe('HomeScreen SSG H1 cleanup (#1609)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('removes the SSG-injected sr-only <h1 data-ssg-travel-h1> once the real content mounts', async () => {
    const ssg = document.createElement('h1')
    ssg.setAttribute('data-ssg-travel-h1', 'true')
    ssg.textContent = 'Идеи поездок на выходные и книга путешествий'
    document.body.insertBefore(ssg, document.body.firstChild)
    expect(document.querySelectorAll('h1[data-ssg-travel-h1]').length).toBe(1)

    const HomeScreen = loadHomeScreen()
    render(<HomeScreen />)

    await waitFor(() => {
      expect(document.querySelectorAll('h1[data-ssg-travel-h1]').length).toBe(0)
    })
  })

  it('does not touch unrelated stale h1 markers when not on the home path', async () => {
    // isHomePath resolves from window.location.pathname; jsdom defaults to '/'
    // for every test unless changed, so simulate a non-home URL explicitly.
    const originalLocation = window.location
    // @ts-expect-error jsdom allows reassigning location in tests
    delete window.location
    // @ts-expect-error partial Location for the pathname read HomeScreen uses
    window.location = { ...originalLocation, pathname: '/travels/some-slug' }

    const ssg = document.createElement('h1')
    ssg.setAttribute('data-ssg-travel-h1', 'true')
    document.body.insertBefore(ssg, document.body.firstChild)

    const HomeScreen = loadHomeScreen()
    render(<HomeScreen />)

    // HomeScreen renders null (not home path) and never mounts the cleanup
    // effect; the marker belongs to whatever other route is actually live.
    // There's no "ready" signal to await for the negative case, so a real
    // timer flush is the only way to prove the effect never ran.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(document.querySelectorAll('h1[data-ssg-travel-h1]').length).toBe(1)

    // @ts-expect-error restore the real jsdom location for later tests
    window.location = originalLocation
  })
})
