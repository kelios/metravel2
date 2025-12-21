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
      <div data-section-key="section-1"></div>
      <div data-section-key="section-2"></div>
    `
  })

  it('updates activeSection when intersection entries indicate visible section', () => {
    const anchors = {
      'section-1': { current: null },
      'section-2': { current: null },
    }

    const { result } = renderHook(() => useActiveSection(anchors, 0))

    // Wait for the Intersection Observer to be set up
    act(() => {
      // Simulate the Intersection Observer callback being called directly
      const mockTarget = {
        getAttribute: (name: string) => (name === 'data-section-key' ? 'section-1' : null),
        boundingClientRect: {
          top: 0,
          bottom: 200,
        },
      } as any

      lastObserverCallback?.(
        [
          {
            target: mockTarget,
            isIntersecting: true,
            boundingClientRect: mockTarget.boundingClientRect,
            intersectionRatio: 0.8,
          } as any,
        ],
        null as any
      )
    })

    expect(result.current.activeSection).toBe('section-1')
  })
})
