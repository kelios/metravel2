import React, { createRef } from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { useActiveSection } from '@/hooks/useActiveSection'

// Простая заглушка для IntersectionObserver
class MockIntersectionObserver {
  callback: IntersectionObserverCallback
  elements: Element[] = []

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
  }

  observe = (element: Element) => {
    this.elements.push(element)
  }

  unobserve = () => {}

  disconnect = () => {}
}

describe('useActiveSection', () => {
  beforeEach(() => {
    const RN = require('react-native')
    RN.Platform.OS = 'web'

    ;(global as any).IntersectionObserver = MockIntersectionObserver as any

    // Простейшая разметка секций
    document.body.innerHTML = `
      <div data-section-key="section-1"></div>
      <div data-section-key="section-2"></div>
    `
  })

  it('updates activeSection when intersection entries indicate visible section', () => {
    const anchors = {
      'section-1': createRef<any>(),
      'section-2': createRef<any>(),
    }

    const { result } = renderHook(() => useActiveSection(anchors, 0))

    // Находим инстанс мокового observer
    const observerInstance = (IntersectionObserver as unknown as jest.Mock).
      mock.instances[0] as unknown as MockIntersectionObserver

    const targets = Array.from(document.querySelectorAll('[data-section-key]'))

    act(() => {
      observerInstance.callback(
        [
          {
            target: targets[0],
            isIntersecting: true,
            boundingClientRect: {
              top: 0,
              bottom: 200,
            },
            intersectionRatio: 0.8,
          } as any,
        ],
        observerInstance as any
      )
    })

    expect(result.current.activeSection).toBe('section-1')
  })
})
