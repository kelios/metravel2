/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render } from '@testing-library/react'

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native')
  return {
    ...RN,
    Platform: { OS: 'web', select: (obj: any) => obj.web || obj.default },
    useWindowDimensions: () => ({ width: 1200, height: 800 }),
  }
})

describe('TravelDetailsContainer performance (web)', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    ;(window as any).innerWidth = 1200
  })

  it('OptimizedLCPHero renders an eager high-priority LCP image', () => {
    const { __testables } = require('@/components/travel/details/TravelDetailsContainer')
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

  it('useLCPPreload injects preload link for first gallery image', () => {
    const { __testables } = require('@/components/travel/details/TravelDetailsContainer')
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

    const preload = document.head.querySelector('link[rel="preload"][as="image"]') as any
    expect(preload).toBeTruthy()
    expect(preload.getAttribute('fetchpriority')).toBe('high')
  })
})
