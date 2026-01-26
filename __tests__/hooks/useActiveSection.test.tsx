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

    expect(lastObserverCallback).not.toBeNull()
    expect(['', 'section-1']).toContain(result.current.activeSection)

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

  it('prefers section spanning header line over the first section below it (regression)', () => {
    const anchors = {
      'section-1': { current: null },
      'section-2': { current: null },
    }

    const { result } = renderHook(() => useActiveSection(anchors, 0))

    // headerLine = 24 (TOP_BUFFER_PX). section-1 spans it; section-2 starts below.
    const s1 = document.getElementById('section-1') as any
    const s2 = document.getElementById('section-2') as any
    s1.getBoundingClientRect = jest.fn(() => ({ top: -10, bottom: 200, height: 210 } as any))
    s2.getBoundingClientRect = jest.fn(() => ({ top: 30, bottom: 230, height: 200 } as any))

    act(() => {
      lastObserverCallback?.([], null as any)
    })

    expect(result.current.activeSection).toBe('section-1')
  })

  it('updates activeSection when a lazy-mounted section appears later (regression)', () => {
    const anchors = {
      'section-1': { current: null },
      'section-2': { current: null },
    }

    const { result } = renderHook(() => useActiveSection(anchors, 0))

    expect(lastObserverCallback).not.toBeNull()

    const s1 = document.getElementById('section-1') as any
    s1.getBoundingClientRect = jest.fn(() => ({ top: 10, bottom: 210, height: 200 } as any))

    act(() => {
      lastObserverCallback?.([], null as any)
    })

    expect(result.current.activeSection).toBe('section-1')

    const s2 = document.createElement('div')
    s2.setAttribute('data-section-key', 'section-2')
    s2.id = 'section-2'
    document.body.appendChild(s2)

    expect(document.querySelector('[data-section-key="section-2"]')?.getAttribute('data-section-key')).toBe('section-2')

    s2.getBoundingClientRect = jest.fn(() => ({ top: 8, bottom: 240, height: 232 } as any))
    s1.getBoundingClientRect = jest.fn(() => ({ top: -320, bottom: -120, height: 200 } as any))

    act(() => {
      lastObserverCallback?.([], null as any)
    })

    expect(result.current.activeSection).toBe('section-2')
  })
})
