import React from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import type { View } from 'react-native'
import ActionTooltip, { positionActionTooltip } from '@/components/ui/ActionTooltip.web'

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({ text: 'black', surface: 'white' }),
}))

afterEach(() => { cleanup(); jest.restoreAllMocks() })

describe('ActionTooltip — viewport positioning', () => {
  const tooltip = { width: 200, height: 40 }
  const viewport = { width: 320, height: 640 }

  it.each([
    { left: 0, right: 44, top: 100, bottom: 144 },
    { left: 276, right: 320, top: 100, bottom: 144 },
  ])('keeps edge action labels fully inside the viewport', (anchor) => {
    const position = positionActionTooltip(anchor, tooltip, viewport)
    expect(position.left).toBeGreaterThanOrEqual(0)
    expect(position.left + tooltip.width).toBeLessThanOrEqual(viewport.width)
    expect(position.top + tooltip.height).toBeLessThan(anchor.top)
  })

  it('flips below a button at the top of the viewport', () => {
    const anchor = { left: 100, right: 144, top: 8, bottom: 52 }
    const position = positionActionTooltip(anchor, tooltip, viewport)
    expect(position.top).toBeGreaterThan(anchor.bottom)
    expect(position.top + tooltip.height).toBeLessThanOrEqual(viewport.height)
  })

  it('preserves bottom/left preferences and flips a bottom tooltip at the viewport edge', () => {
    const anchor = { left: 250, right: 294, top: 150, bottom: 194 }
    const bottom = positionActionTooltip(anchor, tooltip, viewport, 'bottom')
    expect(bottom.top).toBeGreaterThan(anchor.bottom)
    const left = positionActionTooltip(anchor, tooltip, viewport, 'left')
    expect(left.left + tooltip.width).toBeLessThan(anchor.left)
    const lowAnchor = { ...anchor, top: 570, bottom: 614 }
    expect(positionActionTooltip(lowAnchor, tooltip, viewport, 'bottom').top + tooltip.height)
      .toBeLessThan(lowAnchor.top)
  })
})

describe('ActionTooltip — portal lifecycle', () => {
  it('escapes the button container and tracks scroll, resize, dismissal and cleanup', () => {
    const anchor = document.createElement('button')
    document.body.appendChild(anchor)
    let anchorTop = 150
    jest.spyOn(anchor, 'getBoundingClientRect').mockImplementation(() => ({
      left: 100, right: 144, top: anchorTop, bottom: anchorTop + 44,
      width: 44, height: 44, x: 100, y: anchorTop, toJSON: () => ({}),
    }))
    const onDismiss = jest.fn()
    const props = {
      anchorRef: { current: anchor as unknown as View },
      label: 'Скачать офлайн', visible: true, onDismiss,
    }
    const { container, getByRole, rerender, unmount } = render(<ActionTooltip {...props} />)
    const tooltip = getByRole('tooltip')
    expect(tooltip.parentElement).toBe(document.body)
    expect(container.contains(tooltip)).toBe(false)
    const initialTop = tooltip.style.top
    anchorTop = 200
    fireEvent.scroll(window)
    expect(tooltip.style.top).not.toBe(initialTop)
    anchorTop = 250
    fireEvent.resize(window)
    expect(Number.parseFloat(tooltip.style.top)).toBeLessThan(anchorTop)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalledTimes(1)
    rerender(<ActionTooltip {...props} visible={false} />)
    expect(document.querySelector('[role="tooltip"]')).toBeNull()
    unmount()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalledTimes(1)
    anchor.remove()
  })
})
