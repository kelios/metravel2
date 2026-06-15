/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render } from '@testing-library/react'

// The shell renders a deep tree (hero, maps, sidebar). For the single-H1
// regression we only care about the shell's own visible <h1> and the cleanup
// of the SSG-injected sr-only <h1 data-ssg-travel-h1>, so stub the heavy
// children to keep the test focused and deterministic.
jest.mock('@/components/travel/CompactSideBarTravel', () => () => null)
jest.mock('@/components/travel/details/TravelDetailsSkeletonOverlay', () => () => null)
jest.mock('@/components/travel/details/TravelDetailsHeroDeferredColumn', () => () => null)

describe('TravelDetailsCriticalShell single H1 (web)', () => {
  beforeEach(() => {
    const RN = require('react-native')
    RN.Platform.OS = 'web'
    RN.Platform.select = (obj: any) => obj.web ?? obj.default
    document.body.innerHTML = ''
  })

  function renderShell() {
    const Shell = require('@/components/travel/details/TravelDetailsCriticalShell').default
    const { Animated } = require('react-native')
    return render(
      <Shell
        travel={{ id: 1, name: 'Тропа ведьм' } as any}
        isMobile={false}
        screenWidth={1280}
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

  it('renders exactly one visible <h1> with the travel name', () => {
    const { container } = renderShell()
    const h1s = container.querySelectorAll('h1')
    expect(h1s.length).toBe(1)
    expect(h1s[0].textContent).toBe('Тропа ведьм')
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
})
