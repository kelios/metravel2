import type React from 'react'
import type { Root } from 'react-dom/client'

let act: typeof import('react').act
let createElement: typeof import('react').createElement
let createRoot: typeof import('react-dom/client').createRoot
let IconButton: React.ComponentType<any>

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('@/components/ui/ActionTooltip', () => jest.requireActual('@/components/ui/ActionTooltip.web'))
  ;({ act, createElement } = require('react'))
  ;({ createRoot } = require('react-dom/client'))
  IconButton = require('@/components/ui/IconButton').default
})

describe('IconButton web tooltip layer (#2296)', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    container.style.overflow = 'hidden'
    container.style.transform = 'translateX(0)'
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    jest.restoreAllMocks()
  })

  it.each([1280, 1440])('portals outside clipped stacking contexts at %s px', async (width) => {
    jest.replaceProperty(window, 'innerWidth', width)
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const isTooltip = this.getAttribute('role') === 'tooltip'
      return { left: 987, right: 1031, top: 154, bottom: 198,
        width: isTooltip ? 126 : 44, height: isTooltip ? 34 : 44,
        x: 987, y: 154, toJSON: () => ({}) } as DOMRect
    })
    await act(async () => root.render(createElement(IconButton, {
      icon: null, label: 'Удалить диалог', testID: 'delete',
    })))
    const button = container.querySelector('[data-testid="delete"]')!
    expect(button.hasAttribute('aria-selected')).toBe(false)
    const hover = new MouseEvent(typeof window.PointerEvent === 'function' ? 'pointerenter' : 'mouseenter')
    Object.defineProperty(hover, 'pointerType', { value: 'mouse' })
    await act(async () => button.dispatchEvent(hover))
    const tooltip = document.querySelector('[role="tooltip"]') as HTMLElement
    expect(tooltip).not.toBeNull()
    expect(tooltip.parentElement).toBe(document.body)
    expect(container.contains(tooltip)).toBe(false)
    expect(tooltip.style.position).toBe('fixed')
    expect(tooltip.style.visibility).toBe('visible')
    expect(Number.parseFloat(tooltip.style.left) + 126).toBeLessThanOrEqual(width)
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(document.querySelector('[role="tooltip"]')).toBeNull()
  })
})
