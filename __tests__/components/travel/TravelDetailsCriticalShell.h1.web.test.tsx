import type React from 'react'
import type { Root } from 'react-dom/client'

let act: typeof import('react').act
let createElement: typeof import('react').createElement
let createRoot: typeof import('react-dom/client').createRoot
const mountedRoots: Root[] = []

beforeAll(() => {
  // Same isolated RN-web recipe as the other real-DOM travel regressions.
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  ;({ act, createElement } = require('react'))
  ;({ createRoot } = require('react-dom/client'))
})

function render(element: React.ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mountedRoots.push(root)
  act(() => { root.render(element) })
  return { container }
}

// The shell renders a deep tree (hero, maps, sidebar). For the single-H1
// regression we only care about the shell's own visible <h1>, its placement
// between the gallery and the facts/actions (the hero renders it through
// `titleSlot`), and cleanup of the SSG-injected sr-only H1.
jest.mock('@/components/travel/CompactSideBarTravel', () => () => null)
jest.mock('@/components/travel/details/TravelDetailsSkeletonOverlay', () => () => null)
jest.mock('@/components/travel/details/TravelHeroSlots', () => {
  const React = require('react')
  return {
    TravelHeroFavoriteToggleSlot: () =>
      React.createElement('button', { 'data-testid': 'favorite-action' }, 'Хочу поехать'),
  }
})
jest.mock('@/components/travel/details/TravelDetailsHeroDeferredColumn', () => {
  const React = require('react')
  return {
    TravelDetailsHeroBlock: ({ titleSlot }: { titleSlot?: unknown }) =>
      React.createElement(
        React.Fragment,
        null,
        React.createElement('div', { 'data-testid': 'hero-block' }),
        titleSlot,
        React.createElement('div', { 'data-testid': 'hero-extras' }),
      ),
    TravelDetailsContentBlock: () => React.createElement('div', { 'data-testid': 'content-block' }),
  }
})

describe('TravelDetailsCriticalShell single H1 (web)', () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    document.body.innerHTML = ''
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    act(() => { mountedRoots.splice(0).forEach(root => root.unmount()) })
    consoleErrorSpy.mockRestore()
  })

  function renderShell({
    isMobile = false,
    screenWidth = 1280,
    travel = { id: 1, name: 'Тропа ведьм' },
    loaderTravel = false,
  }: { isMobile?: boolean; screenWidth?: number; travel?: Record<string, unknown> | null; loaderTravel?: boolean } = {}) {
    const Shell = require('@/components/travel/details/TravelDetailsCriticalShell').default
    const { TravelLoaderDataContext } = require('@/components/travel/details/travelLoaderData')
    const { Animated } = require('react-native')
    return render(createElement(TravelLoaderDataContext.Provider,
      { value: loaderTravel ? { travel } : null },
      createElement(Shell, {
        travel, isMobile, screenWidth, wrapperStyle: {}, styles: {},
        skeletonPhase: 'hidden', skeletonFallback: null,
        scrollRef: { current: null }, scrollViewStyle: {},
        scrollEventHandler: () => {}, handleContentSizeChange: () => {}, handleLayout: () => {},
        contentHorizontalPadding: 16, anchors: {}, onFirstImageLoad: () => {},
        sectionLinks: [], onQuickJump: () => {}, deferHeroExtras: false,
        forceOpenKey: null, activeSection: null, closeMenu: () => {}, onNavigate: () => {},
        menuWidthNum: 320, animatedX: new Animated.Value(0), sideMenuPlatformStyles: {},
        deferredContent: null, mainAriaLabel: 'Тропа ведьм',
      }),
    ))
  }

  describe('loaded web geometry ownership (#3398)', () => {
    it.each([
      ['hydration snapshot', true, 0],
      ['mobile', true, 390],
      ['desktop', false, 1100],
    ])('provides the same CSS-owned structure without claiming loader SSR (%s)', (_label, isMobile, screenWidth) => {
      const { container } = renderShell({ isMobile, screenWidth })
      const root = container.querySelector('[data-testid="travel-details-page"]')!
      expect(root.getAttribute('data-travel-web-layout')).toBe('true')
      expect(root.hasAttribute('data-router-ssr')).toBe(false)
      expect(container.querySelector('[data-router-travel-h1]')).toBeNull()
      expect(container.querySelectorAll('[data-travel-web-layout-styles="true"]')).toHaveLength(1)
      expect(container.querySelectorAll('[data-travel-web-content="true"]')).toHaveLength(1)
      expect(container.querySelectorAll('[data-travel-web-sidebar="true"]')).toHaveLength(1)
    })

    it('retains real loader SSR markers while using the same single geometry stylesheet', () => {
      const { container } = renderShell({ isMobile: true, screenWidth: 0, loaderTravel: true })
      const root = container.querySelector('[data-testid="travel-details-page"]')!
      expect(root.getAttribute('data-router-ssr')).toBe('travel')
      expect(root.getAttribute('data-travel-web-layout')).toBe('true')
      expect(container.querySelector('[data-router-travel-h1="true"]')).not.toBeNull()
      expect(container.querySelectorAll('[data-travel-web-layout-styles="true"]')).toHaveLength(1)
    })

    it('does not apply loaded geometry to the no-data loading shell', () => {
      const { container } = renderShell({ isMobile: true, screenWidth: 0, travel: null })
      const root = container.querySelector('[data-testid="travel-details-page"]')!
      expect(root.hasAttribute('data-travel-web-layout')).toBe(false)
      expect(root.hasAttribute('data-router-ssr')).toBe(false)
      expect(container.querySelector('[data-travel-web-layout-styles]')).toBeNull()
    })
  })

  it.each([
    ['desktop web', false, 1280, '34px'],
    ['mobile web', true, 390, '28px'],
  ])(
    'renders exactly one visible <h1> with the travel name on %s',
    (_label, isMobile, screenWidth, fontSize) => {
      const { container } = renderShell({ isMobile, screenWidth })
      const h1s = container.querySelectorAll('h1')
      expect(h1s.length).toBe(1)
      expect(h1s[0].textContent).toBe('Тропа ведьм')
      expect(h1s[0].getAttribute('data-testid')).toBe('travel-details-title')
      expect(h1s[0].style.position).not.toBe('absolute')
      expect(h1s[0].style.width).not.toBe('1px')
      expect(h1s[0].style.height).not.toBe('1px')
      expect(h1s[0].style.overflow).not.toBe('hidden')
      expect(h1s[0].style.clip).toBe('')
      expect(h1s[0].style.clipPath).toBe('')
      expect(h1s[0].style.display).not.toBe('none')
      expect(h1s[0].style.visibility).not.toBe('hidden')
      expect(h1s[0].style.fontSize).toBe(fontSize)

      // DOM = visual order on desktop: gallery → heading row (h1 + «Хочу
      // поехать») → facts/actions → article.
      const hero = container.querySelector('[data-testid="hero-block"]')
      const heading = container.querySelector('[data-travel-first-screen="heading"]')
      const extras = container.querySelector('[data-testid="hero-extras"]')
      const content = container.querySelector('[data-testid="content-block"]')
      expect(hero?.nextElementSibling).toBe(heading)
      expect(heading?.firstElementChild).toBe(h1s[0])
      const favorite = container.querySelector('[data-travel-first-screen="favorite"]')
      expect(h1s[0].nextElementSibling).toBe(favorite)
      expect(favorite?.parentElement).toBe(heading)
      expect(favorite?.querySelector('[data-testid="favorite-action"]')).not.toBeNull()
      expect(heading?.nextElementSibling).toBe(extras)
      expect(extras?.nextElementSibling).toBe(content)
    },
  )

  // Mobile opens with h1 → meta → favorite → gallery. The mobile CSS lifts the
  // heading row before the gallery while preserving the desktop DOM order.
  describe('mobile first screen (#2904)', () => {
    const fullTravel = {
      id: 1,
      name: 'Гродно за 1 день: что посмотреть и как доехать',
      userName: 'Юля',
      monthName: 'Октябрь',
      year: '2019',
      number_days: 1,
      countryName: 'Беларусь',
    }

    const firstScreenCss = (container: HTMLElement) => {
      const { TRAVEL_FIRST_SCREEN_STYLES } = require('@/components/travel/details/travelFirstScreenLayout')
      const style = Array.from(container.ownerDocument.querySelectorAll('style'))
        .find((node) => node.textContent === TRAVEL_FIRST_SCREEN_STYLES)
      expect(style).toBeDefined()
      const css = String(style?.textContent)
      const mediaStart = css.indexOf('@media(max-width:767.98px){')
      expect(mediaStart).toBeGreaterThan(-1)
      return { outside: css.slice(0, mediaStart), mobile: css.slice(mediaStart) }
    }

    it.each([
      ['desktop web', false, 1280],
      ['mobile web', true, 390],
    ])('renders the meta line right after the h1, before the article (%s)', (_label, isMobile, screenWidth) => {
      const { container } = renderShell({ isMobile, screenWidth, travel: fullTravel })
      const h1 = container.querySelector('h1') as HTMLElement
      const meta = container.querySelector('[data-travel-first-screen="meta"]') as HTMLElement
      const hero = container.querySelector('[data-testid="hero-block"]')
      const heading = container.querySelector('[data-travel-first-screen="heading"]')
      const extras = container.querySelector('[data-testid="hero-extras"]')

      expect(h1.getAttribute('data-travel-first-screen')).toBe('title')
      expect(meta.textContent).toBe('Юля · Октябрь 2019 · 1 день · Беларусь')
      // One DOM order for every width: the mobile lift lives only in CSS.
      expect(hero?.nextElementSibling).toBe(heading)
      expect(heading?.firstElementChild).toBe(h1)
      expect(h1.nextElementSibling).toBe(meta)
      const favorite = container.querySelector('[data-travel-first-screen="favorite"]')
      expect(meta.nextElementSibling).toBe(favorite)
      expect(favorite?.nextElementSibling).toBeNull()
      expect(heading?.nextElementSibling).toBe(extras)
      // Visibility of the meta line is owned by the stylesheet, not inline style.
      expect(meta.getAttribute('style')).toBeNull()
      expect(container.querySelectorAll('h1')).toHaveLength(1)
    })

    it('lifts the heading row above the gallery only below 768 px', () => {
      const { container } = renderShell({ isMobile: true, screenWidth: 390, travel: fullTravel })
      const { outside, mobile: rest } = firstScreenCss(container)
      const desktopStart = rest.indexOf('@media(min-width:768px){')
      expect(desktopStart).toBeGreaterThan(-1)
      const mobile = rest.slice(0, desktopStart)
      const desktop = rest.slice(desktopStart)

      expect(mobile).toContain('[data-travel-first-screen="heading"]{order:-1}')
      expect(mobile).toMatch(/\[data-travel-first-screen="title"\]\{order:-1;/)
      expect(mobile).toMatch(/\[data-travel-first-screen="meta"\]\{order:-1;display:block;height:20px;/)
      // Never clipped: post-deploy SEO check rejects a clamped travel H1.
      for (const block of [mobile, desktop]) {
        const titleRule = block.match(/\[data-travel-first-screen="title"\]\{([^}]*)\}/)?.[1] ?? ''
        expect(titleRule).not.toBe('')
        expect(titleRule).not.toMatch(/line-clamp|overflow/)
      }
      // Outside the media queries nothing touches the h1; the meta line is
      // simply not displayed there.
      expect(outside).not.toContain('"title"')
      expect(outside).not.toContain('order')
      expect(outside.trim()).toContain('[data-travel-first-screen="meta"]{display:none}')
      expect(mobile).toContain('[data-travel-first-screen="heading"]{order:-1}')
      // Desktop: h1 and «Хочу поехать» share one row; nothing is reordered.
      expect(desktop).toContain('[data-travel-first-screen="heading"]{display:flex;')
      expect(desktop).not.toContain('order')
    })

    it('hides the quick-jump tabs only where the desktop sidebar carries the same navigation', () => {
      const { container } = renderShell({ isMobile: true, screenWidth: 390, travel: fullTravel })
      const { outside, mobile: rest } = firstScreenCss(container)
      expect(outside).not.toContain('data-travel-quick-jumps')
      const sidebarStart = rest.indexOf('@media(min-width:1280px){')
      expect(sidebarStart).toBeGreaterThan(-1)
      expect(rest.slice(0, sidebarStart)).not.toContain('data-travel-quick-jumps')
      expect(rest.slice(sidebarStart)).toContain('[data-travel-quick-jumps="true"]{display:none!important}')
    })

    it('omits the meta line when the travel has no author, date, days or country', () => {
      const { container } = renderShell({ isMobile: true, screenWidth: 390 })
      expect(container.querySelector('[data-travel-first-screen="meta"]')).toBeNull()
    })
  })

  it('removes the SSG-injected sr-only <h1 data-ssg-travel-h1> on mount', () => {
    const ssg = document.createElement('h1')
    ssg.setAttribute('data-ssg-travel-h1', 'true')
    ssg.textContent = 'Тропа ведьм'
    document.body.insertBefore(ssg, document.body.firstChild)
    expect(document.querySelectorAll('h1[data-ssg-travel-h1]').length).toBe(1)

    renderShell()

    expect(document.querySelectorAll('h1[data-ssg-travel-h1]').length).toBe(0)
    expect(document.querySelectorAll('h1').length).toBe(1)
  })

  it('preserves the visible .ssg-travel-h1 until the SSG shell teardown', () => {
    const ssg = document.createElement('div')
    ssg.className = 'ssg-travel-h1'
    ssg.textContent = 'Тропа ведьм'
    document.body.insertBefore(ssg, document.body.firstChild)
    expect(document.querySelectorAll('.ssg-travel-h1').length).toBe(1)

    renderShell()

    expect(document.querySelectorAll('.ssg-travel-h1').length).toBe(1)
  })

  it('demotes the visible SSG H1 without changing its placeholder geometry class', () => {
    const skeleton = document.createElement('div')
    skeleton.id = 'ssg-skeleton'
    const ssg = document.createElement('h1')
    ssg.className = 'ssg-travel-h1'
    ssg.textContent = 'Тропа ведьм'
    skeleton.appendChild(ssg)
    document.body.insertBefore(skeleton, document.body.firstChild)

    renderShell()

    expect(document.querySelectorAll('h1')).toHaveLength(1)
    expect(document.querySelector('h1[data-testid="travel-details-title"]')).not.toBeNull()
    const placeholder = document.querySelector('div.ssg-travel-h1')
    expect(placeholder?.textContent).toBe('Тропа ведьм')
  })

  it('signals that the React first screen replaced the SSG shell', () => {
    const root = document.createElement('div')
    root.id = 'root'
    document.body.appendChild(root)

    renderShell()

    expect(root.getAttribute('data-travel-details-ready')).toBe('true')
  })
})
