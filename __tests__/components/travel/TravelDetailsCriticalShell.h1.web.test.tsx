import { render } from '@testing-library/react'

// The shell renders a deep tree (hero, maps, sidebar). For the single-H1
// regression we only care about the shell's own visible <h1>, its placement
// between the hero and article, and cleanup of the SSG-injected sr-only H1.
jest.mock('@/components/travel/CompactSideBarTravel', () => () => null)
jest.mock('@/components/travel/details/TravelDetailsSkeletonOverlay', () => () => null)
jest.mock('@/components/travel/details/TravelDetailsHeroDeferredColumn', () => {
  const React = require('react')
  return {
    TravelDetailsHeroBlock: () => React.createElement('div', { 'data-testid': 'hero-block' }),
    TravelDetailsContentBlock: () => React.createElement('div', { 'data-testid': 'content-block' }),
  }
})

describe('TravelDetailsCriticalShell single H1 (web)', () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    const RN = require('react-native')
    RN.Platform.OS = 'web'
    RN.Platform.select = (obj: any) => obj.web ?? obj.default
    document.body.innerHTML = ''
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  function renderShell({
    isMobile = false,
    screenWidth = 1280,
    travel = { id: 1, name: 'Тропа ведьм' },
  }: { isMobile?: boolean; screenWidth?: number; travel?: Record<string, unknown> } = {}) {
    const Shell = require('@/components/travel/details/TravelDetailsCriticalShell').default
    const { Animated } = require('react-native')
    return render(
      <Shell
        travel={travel as any}
        isMobile={isMobile}
        screenWidth={screenWidth}
        wrapperStyle={{}}
        styles={{}}
        skeletonPhase="hidden"
        skeletonFallback={null}
        scrollRef={{ current: null }}
        scrollViewStyle={{}}
        scrollEventHandler={() => {}}
        handleContentSizeChange={() => {}}
        handleLayout={() => {}}
        contentHorizontalPadding={16}
        anchors={{}}
        onFirstImageLoad={() => {}}
        sectionLinks={[]}
        onQuickJump={() => {}}
        deferHeroExtras={false}
        forceOpenKey={null}
        activeSection={null}
        closeMenu={() => {}}
        onNavigate={() => {}}
        menuWidthNum={320}
        animatedX={new Animated.Value(0)}
        sideMenuPlatformStyles={{}}
        deferredContent={null}
        mainAriaLabel="Тропа ведьм"
      />
    )
  }

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

      const hero = container.querySelector('[data-testid="hero-block"]')
      const content = container.querySelector('[data-testid="content-block"]')
      expect(hero?.nextElementSibling).toBe(h1s[0])
      expect(h1s[0].nextElementSibling).toBe(content)
    },
  )

  // #2904: mobile opens with h1 → meta → gallery. The DOM keeps the desktop
  // order (hero → h1 → content) and a CSS rule scoped to < 768 px lifts the h1
  // and meta with `order:-1`, so neither SSR nor hydration flips the layout.
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
      const content = container.querySelector('[data-testid="content-block"]')

      expect(h1.getAttribute('data-travel-first-screen')).toBe('title')
      expect(meta.textContent).toBe('Юля · Октябрь 2019 · 1 день · Беларусь')
      // Desktop DOM order is preserved: the flex order lives only in CSS.
      expect(hero?.nextElementSibling).toBe(h1)
      expect(h1.nextElementSibling).toBe(meta)
      expect(meta.nextElementSibling).toBe(content)
      // Visibility of the meta line is owned by the stylesheet, not inline style.
      expect(meta.getAttribute('style')).toBeNull()
      expect(container.querySelectorAll('h1')).toHaveLength(1)
    })

    it('lifts the h1 and meta above the gallery only below 768 px', () => {
      const { container } = renderShell({ isMobile: true, screenWidth: 390, travel: fullTravel })
      const { outside, mobile } = firstScreenCss(container)

      expect(mobile).toMatch(/\[data-travel-first-screen="title"\]\{order:-1;/)
      expect(mobile).toMatch(/\[data-travel-first-screen="meta"\]\{order:-1;display:block;height:20px;/)
      // Never clipped: post-deploy SEO check rejects a clamped travel H1.
      const titleRule = mobile.match(/\[data-travel-first-screen="title"\]\{([^}]*)\}/)?.[1] ?? ''
      expect(titleRule).not.toBe('')
      expect(titleRule).not.toMatch(/line-clamp|overflow/)
      // Outside the mobile media query nothing touches the h1 (desktop layout
      // unchanged); the meta line is simply not displayed there.
      expect(outside).not.toContain('"title"')
      expect(outside).not.toContain('order')
      expect(outside.trim()).toBe('[data-travel-first-screen="meta"]{display:none}')
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
