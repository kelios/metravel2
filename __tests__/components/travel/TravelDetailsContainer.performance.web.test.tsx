/**
 * @jest-environment jsdom
 */

import React from 'react'
import { fireEvent, render } from '@testing-library/react'

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
    ;(window as any).devicePixelRatio = 1
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
    expect(lcpImg?.style.objectFit).toBe('contain')
  })

  it('renders only segmented blur surround immediately so the LCP shell keeps the same-source backdrop without a full-frame blur candidate', () => {
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
    const heroBackdropBase = container.querySelector('[data-hero-backdrop-base="true"]') as HTMLDivElement | null
    const heroBackdropSegments = container.querySelectorAll('[data-hero-backdrop-segment="true"]')
    const heroBackdropLayer = container.querySelector('[data-hero-backdrop-layer="true"]') as HTMLDivElement | null

    expect(heroBackdrop).toBeTruthy()
    expect(lcpImg).toBeTruthy()
    expect(heroBackdropBase).toBeNull()
    expect(heroBackdrop?.tagName).toBe('DIV')
    expect(heroBackdropSegments.length).toBeGreaterThan(1)
    expect(heroBackdropLayer?.style.backgroundImage).toContain(lcpImg?.getAttribute('src') || '')
    expect(heroBackdropLayer?.style.opacity).toBe('1')
    expect(heroBackdropLayer?.style.animation).toBe('')

    if (lcpImg) {
      fireEvent.load(lcpImg)
    }

    expect(container.querySelector('[data-hero-backdrop="true"]')).toBeTruthy()
  })

  it('keeps mobile hero URL preload-friendly on high-DPR web devices', () => {
    ;(window as any).innerWidth = 390
    ;(window as any).devicePixelRatio = 3

    const { container } = render(
      <__testables.OptimizedLCPHero
        img={{
          url: 'https://metravel.by/gallery/540/gallery/79641dcc63dc476bb89dd66a9faa8527.JPG',
          width: 1200,
          height: 800,
          updated_at: '2025-01-01',
          id: 1,
        }}
        alt='Hero image'
        isMobile
        height={520}
        containerWidth={390}
      />,
    )

    const lcpImg = container.querySelector('img[data-lcp]') as HTMLImageElement | null
    expect(lcpImg).toBeTruthy()
    expect(lcpImg?.getAttribute('src')).toContain('w=720')
    expect(lcpImg?.getAttribute('src')).not.toContain('dpr=')
    expect(lcpImg?.getAttribute('srcset')).toContain('w=640')
    expect(lcpImg?.getAttribute('srcset')).toContain('w=720')
    expect(lcpImg?.getAttribute('srcset')).not.toContain('dpr=')
  })

  // useLCPPreload was removed — preloading is handled by the inline script in +html.tsx
})
