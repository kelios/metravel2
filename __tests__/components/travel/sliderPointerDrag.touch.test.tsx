/**
 * @jest-environment jsdom
 *
 * Regression: mobile touch swipe must survive the browser's implicit pointer
 * capture. Chromium and iOS Safari implicitly capture touch pointers, so EVERY
 * finger release fires `lostpointercapture` BEFORE `touchend`. The handler for
 * `lostpointercapture` (needed for the mouse drag path) must not cancel a
 * touch-driven drag, otherwise the slider follows the finger and snaps back on
 * release — the recurring "мёртвый свайп" on iPhone (broken 2026-06-19, 3e075b26).
 */

import React from 'react'
import renderer, { act } from 'react-test-renderer'

import { useSliderPointerDrag } from '@/components/travel/sliderParts/useSliderPointerDrag'

const SLIDE_WIDTH = 300

type TouchPoint = { clientX: number; clientY: number }

function dispatchTouch(node: HTMLElement, type: string, touches: TouchPoint[]) {
  const event = new Event(type, { bubbles: true, cancelable: true }) as any
  event.touches = touches
  event.changedTouches = touches
  node.dispatchEvent(event)
}

function createHarness() {
  const viewportNode = document.createElement('div')
  const wrapperNode = document.createElement('div')
  document.body.appendChild(wrapperNode)
  wrapperNode.appendChild(viewportNode)

  const indexRef = { current: 0 }
  const containerWRef = { current: SLIDE_WIDTH }
  const applyOffset = jest.fn()
  const scrollTo = jest.fn()
  const snapOffsetForIndex = jest.fn((idx: number) => -idx * SLIDE_WIDTH)

  function Harness() {
    useSliderPointerDrag({
      viewportRef: { current: viewportNode },
      wrapperRef: { current: wrapperNode },
      imagesLen: 3,
      isMobile: true,
      maxIndex: 2,
      indexRef,
      containerWRef,
      renderedSlideWidth: SLIDE_WIDTH,
      applyOffset,
      snapOffsetForIndex,
      stopAnimation: jest.fn(),
      scrollTo,
      pauseAutoplay: jest.fn(),
      resumeAutoplay: jest.fn(),
      dismissSwipeHint: jest.fn(),
      enablePrefetch: jest.fn(),
    })
    return null
  }

  return { Harness, viewportNode, wrapperNode, applyOffset, scrollTo, indexRef }
}

describe('useSliderPointerDrag — raw touch path vs implicit pointer capture', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('completes the swipe even when lostpointercapture fires before touchend', async () => {
    const { Harness, viewportNode, applyOffset, scrollTo } = createHarness()

    let tree: renderer.ReactTestRenderer
    await act(async () => {
      tree = renderer.create(<Harness />)
    })

    const y = 100
    await act(async () => {
      dispatchTouch(viewportNode, 'touchstart', [{ clientX: 290, clientY: y }])
      // horizontal drag: -150px = half a slide, well past the 30% threshold
      for (let i = 1; i <= 6; i++) {
        dispatchTouch(viewportNode, 'touchmove', [{ clientX: 290 - i * 25, clientY: y }])
      }
      // Browser order on finger release for implicitly captured touch pointers:
      // pointerup → lostpointercapture → touchend.
      viewportNode.dispatchEvent(new Event('lostpointercapture', { bubbles: true }))
      dispatchTouch(viewportNode, 'touchend', [])
    })

    // The gesture must resolve to the next slide, not be cancelled by
    // lostpointercapture racing ahead of touchend.
    expect(scrollTo).toHaveBeenCalledWith(1, true)
    // And the drag must not have been snapped back to slide 0 with a transition
    // (the visual signature of the dead swipe).
    const snapBackCalls = applyOffset.mock.calls.filter(
      ([offset, withTransition]) => offset === 0 && withTransition === true,
    )
    expect(snapBackCalls).toHaveLength(0)

    await act(async () => {
      tree!.unmount()
    })
  })

  it('still snaps back via lostpointercapture for mouse-driven drags', async () => {
    const { Harness, viewportNode, applyOffset, scrollTo } = createHarness()

    let tree: renderer.ReactTestRenderer
    await act(async () => {
      tree = renderer.create(<Harness />)
    })

    const firePointer = (type: string, props: Record<string, unknown>) => {
      const event = new Event(type, { bubbles: true, cancelable: true }) as any
      Object.assign(event, props)
      viewportNode.dispatchEvent(event)
    }

    await act(async () => {
      firePointer('pointerdown', { pointerType: 'mouse', pointerId: 7, button: 0, clientX: 290, clientY: 100 })
      firePointer('pointermove', { pointerType: 'mouse', pointerId: 7, clientX: 250, clientY: 100 })
      // Mouse drag loses capture (e.g. browser steals it) — must reset + snap back.
      viewportNode.dispatchEvent(new Event('lostpointercapture', { bubbles: true }))
    })

    expect(scrollTo).not.toHaveBeenCalled()
    // snapOffsetForIndex(0) is -0, which Object.is-inequality would fail against 0
    const snapBack = applyOffset.mock.calls.find(
      ([offset, withTransition, duration]) => offset === 0 && withTransition === true && duration === 200,
    )
    expect(snapBack).toBeTruthy()

    await act(async () => {
      tree!.unmount()
    })
  })
})
