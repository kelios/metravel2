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

  function renderShell({ isMobile = false, screenWidth = 1280 } = {}) {
    const Shell = require('@/components/travel/details/TravelDetailsCriticalShell').default
    const { Animated } = require('react-native')
    return render(
      <Shell
        travel={{ id: 1, name: 'Тропа ведьм' } as any}
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
