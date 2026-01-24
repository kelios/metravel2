import { act, renderHook } from '@testing-library/react-native'
import { useActiveSection } from '@/hooks/useActiveSection'

let lastObserverCallback: IntersectionObserverCallback | null = null

describe('useActiveSection', () => {
  beforeEach(() => {
    const RN = require('react-native')
    RN.Platform.OS = 'web'

    lastObserverCallback = null
    ;(global as any).IntersectionObserver = jest.fn(
      (callback: IntersectionObserverCallback) => {
        lastObserverCallback = callback
        return {
          observe: jest.fn(),
          unobserve: jest.fn(),
          disconnect: jest.fn(),
        }
      }
    ) as any

    // Простейшая разметка секций
    document.body.innerHTML = `
      <div data-section-key="section-1" id="section-1"></div>
      <div data-section-key="section-2" id="section-2"></div>
    `

    // JSDOM doesn't compute layout; stub rects for deterministic scrollspy.
    const s1 = document.getElementById('section-1') as any
    const s2 = document.getElementById('section-2') as any
    s1.getBoundingClientRect = jest.fn(() => ({ top: 30, bottom: 230, height: 200 } as any))
    s2.getBoundingClientRect = jest.fn(() => ({ top: 800, bottom: 1000, height: 200 } as any))
  })

  it('updates activeSection when intersection entries indicate visible section', () => {
    const anchors = {
      'section-1': { current: null },
      'section-2': { current: null },
    }

    const { result } = renderHook(() => useActiveSection(anchors, 0))

    // Wait for the Intersection Observer to be set up
    act(() => {
      // Trigger observer callback; algorithm reads DOM rects directly.
      lastObserverCallback?.([], null as any)
    })

    expect(result.current.activeSection).toBe('section-1')

    // Simulate scrolling down so section-2 reaches the header line.
    const s1 = document.getElementById('section-1') as any
    const s2 = document.getElementById('section-2') as any
    s1.getBoundingClientRect = jest.fn(() => ({ top: -900, bottom: -700, height: 200 } as any))
    s2.getBoundingClientRect = jest.fn(() => ({ top: 10, bottom: 210, height: 200 } as any))

    act(() => {
      lastObserverCallback?.([], null as any)
    })

    expect(result.current.activeSection).toBe('section-2')
  })
})
