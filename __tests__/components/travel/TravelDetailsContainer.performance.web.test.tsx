/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, waitFor } from '@testing-library/react'

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
      />,
    )

    const lcpImg = container.querySelector('img[data-lcp]') as HTMLImageElement | null
    expect(lcpImg).toBeTruthy()
    expect(lcpImg?.getAttribute('loading')).toBe('eager')
    expect(lcpImg?.getAttribute('fetchpriority')).toBe('high')
    expect(lcpImg?.getAttribute('alt')).toBe('Hero image')
  })

  it('useLCPPreload is now a no-op (preloading handled by inline script)', async () => {
    const travel: any = {
      id: 1,
      gallery: [
        {
          url: 'https://cdn.example.com/img.jpg',
          width: 1200,
          height: 800,
          updated_at: '2025-01-01',
          id: 1,
        },
      ],
    }

    const Harness = () => {
      __testables.useLCPPreload(travel, false)
      return null
    }

    render(<Harness />)

    // useLCPPreload should not create any preload links
    // Preloading is now handled by the inline script in +html.tsx
    await waitFor(() => {
      const links = document.head.querySelectorAll('link[rel="preload"], link[rel="prefetch"]')
      expect(links.length).toBe(0)
    })
  })
})
