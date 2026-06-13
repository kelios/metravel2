/**
 * @jest-environment jsdom
 */

import React from 'react'
import { fireEvent, render } from '@testing-library/react'

describe('OptimizedLCPHero SPA image swap (web)', () => {
  let OptimizedLCPHero: any

  beforeAll(() => {
    const RN = require('react-native')
    RN.Platform.OS = 'web'
    RN.Platform.select = (obj: any) => obj.web || obj.default

    OptimizedLCPHero =
      require('@/components/travel/details/TravelDetailsHero').__testables.OptimizedLCPHero
  })

  beforeEach(() => {
    document.head.innerHTML = ''
    ;(window as any).innerWidth = 1200
    ;(window as any).devicePixelRatio = 1
  })

  it('re-notifies onLoad for a new image after the same instance reported an error', () => {
    const onLoad = jest.fn()
    const imgA = { url: 'https://cdn.example.com/a.jpg', width: 1200, height: 800, id: 'a' }
    const imgB = { url: 'https://cdn.example.com/b.jpg', width: 1200, height: 800, id: 'b' }

    const { container, rerender } = render(
      <OptimizedLCPHero img={imgA} alt="A" height={400} isMobile={false} onLoad={onLoad} />
    )

    // Travel A's image fails → overlay gate is released (fail-open) and the
    // neutral error placeholder renders.
    const imgEl = container.querySelector('img[data-lcp]') as HTMLImageElement
    expect(imgEl).toBeTruthy()
    fireEvent.error(imgEl)
    expect(onLoad).toHaveBeenCalledTimes(1)
    expect(
      container.querySelector('[data-testid="travel-hero-neutral-placeholder"]')
    ).toBeTruthy()

    // SPA navigation reuses the same hero instance with travel B's image.
    // The per-image error/notify state must reset so B renders its own <img>
    // and can release the gate again (instead of staying stuck on A's state).
    rerender(
      <OptimizedLCPHero img={imgB} alt="B" height={400} isMobile={false} onLoad={onLoad} />
    )

    const imgElB = container.querySelector('img[data-lcp]') as HTMLImageElement
    expect(imgElB).toBeTruthy()
    expect(imgElB.getAttribute('src')).toContain('b.jpg')
    expect(
      container.querySelector('[data-testid="travel-hero-neutral-placeholder"]')
    ).toBeFalsy()

    // The reset clears didNotifyLoadRef, so B's error path notifies onLoad again.
    fireEvent.error(imgElB)
    expect(onLoad).toHaveBeenCalledTimes(2)
  })
})
