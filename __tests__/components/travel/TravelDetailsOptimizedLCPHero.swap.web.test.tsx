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

  it('lets the browser select the original mobile ladder before hydration without changing the desktop fallback', () => {
    const img = { url: 'https://metravel.by/travel-image/1/conversions/photo-detail_hd.jpg', width: 1200, height: 800, id: 1 }
    const { container, rerender } = render(
      <OptimizedLCPHero img={img} height={400} isMobile viewportHeight />
    )
    const source = container.querySelector('picture > source')
    expect(source?.getAttribute('media')).toBe('(max-width: 767px)')
    expect(source?.getAttribute('sizes')).toBe('100vw')
    expect(source?.getAttribute('srcset')).toMatch(/320w/)
    expect(source?.getAttribute('srcset')).toMatch(/720w/)
    expect(source?.getAttribute('srcset')).not.toMatch(/(?:960|1280)w/)
    expect(container.querySelector('img')?.getAttribute('srcset')).toMatch(/1280w/)

    rerender(<OptimizedLCPHero img={img} height={400} isMobile={false} viewportHeight />)
    expect(container.querySelector('picture > source')?.getAttribute('srcset')).toBe(source?.getAttribute('srcset'))
    rerender(<OptimizedLCPHero img={img} height={400} isMobile />)
    expect(container.querySelector('picture')).toBeNull()
  })

  it('removes stale source candidates when retrying an image through the API prefix', () => {
    const previous = process.env.EXPO_PUBLIC_API_URL
    process.env.EXPO_PUBLIC_API_URL = 'https://metravel.by/api'
    try {
      const img = { url: 'https://metravel.by/travel-image/1/conversions/photo-detail_hd.jpg', width: 1200, height: 800, id: 1 }
      const { container } = render(<OptimizedLCPHero img={img} height={400} viewportHeight />)
      const image = container.querySelector('img[data-lcp]') as HTMLImageElement
      fireEvent.error(image)
      expect(container.querySelector('picture')).toBeNull()
      expect(container.querySelector('img')?.hasAttribute('srcset')).toBe(false)
      expect(container.querySelector('img')?.getAttribute('src')).toContain('/api/travel-image/')
    } finally {
      if (previous === undefined) delete process.env.EXPO_PUBLIC_API_URL
      else process.env.EXPO_PUBLIC_API_URL = previous
    }
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
