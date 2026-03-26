/**
 * @jest-environment jsdom
 */

import React from 'react'
import { fireEvent, render } from '@testing-library/react'

jest.mock('@/hooks/useMenuState', () => ({
  useMenuState: () => ({
    menuOpen: false,
    isMenuOpen: false,
    toggleMenu: jest.fn(),
    openMenu: jest.fn(),
    closeMenu: jest.fn(),
    animatedX: { interpolate: jest.fn(), setValue: jest.fn() },
    animateMenu: jest.fn(),
    menuWidth: 320,
    menuWidthNum: 320,
    openMenuOnDesktop: jest.fn(),
  }),
}))

describe('TravelDetailsContainer performance (web)', () => {
  let __testables: any

  beforeAll(() => {
    const RN = require('react-native')
    RN.Platform.OS = 'web'
    RN.Platform.select = (obj: any) => obj.web || obj.default

    // Important: require AFTER Platform.OS is set, and do not reset modules.
    __testables = require('@/components/travel/details/TravelDetailsHero').__testables
  })

  beforeEach(() => {
    document.head.innerHTML = ''
    ;(window as any).innerWidth = 1200
  })

  it('OptimizedLCPHero renders an eager high-priority LCP image', () => {
    const { container } = render(
      <__testables.OptimizedLCPHero
        img={{
          url: 'https://cdn.example.com/img.jpg',
          width: 1200,
          height: 800,
          updated_at: '2025-01-01',
          id: 1,
        }}
        alt='Hero image'
        isMobile={false}
        height={600}
        containerWidth={720}
      />,
    )

    const lcpImg = container.querySelector('img[data-lcp]') as HTMLImageElement | null
    expect(lcpImg).toBeTruthy()
    expect(lcpImg?.getAttribute('loading')).toBe('eager')
    expect(lcpImg?.getAttribute('fetchpriority')).toBe('high')
    expect(lcpImg?.getAttribute('alt')).toBe('Hero image')
  })

  it('renders the blur backdrop immediately so contain hero has stable blurred surround before slider activation', () => {
    const { container } = render(
      <__testables.OptimizedLCPHero
        img={{
          url: 'https://cdn.example.com/img.jpg',
          width: 1200,
          height: 800,
          updated_at: '2025-01-01',
          id: 1,
        }}
        alt='Hero image'
        isMobile={false}
        height={600}
        containerWidth={720}
      />,
    )

    const lcpImg = container.querySelector('img[data-lcp]') as HTMLImageElement | null
    const heroBackdrop = container.querySelector('[data-hero-backdrop="true"]') as HTMLDivElement | null
    const heroBackdropSegments = container.querySelectorAll('[data-hero-backdrop-segment="true"]')
    const heroBackdropLayer = container.querySelector('[data-hero-backdrop-layer="true"]') as HTMLDivElement | null

    expect(heroBackdrop).toBeTruthy()
    expect(lcpImg).toBeTruthy()
    expect(heroBackdrop?.tagName).toBe('DIV')
    expect(heroBackdropSegments.length).toBeGreaterThan(1)
    expect(heroBackdropLayer?.style.backgroundImage).toContain(lcpImg?.getAttribute('src') || '')

    if (lcpImg) {
      fireEvent.load(lcpImg)
    }

    expect(container.querySelector('[data-hero-backdrop="true"]')).toBeTruthy()
  })

  // useLCPPreload was removed — preloading is handled by the inline script in +html.tsx
})
