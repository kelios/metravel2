import type { Root } from 'react-dom/client'

let ReactActual: typeof import('react')
let createRoot: typeof import('react-dom/client').createRoot
let RN: typeof import('react-native')
let Menu: typeof import('@/ui/paper').Menu

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  ReactActual = require('react')
  ;({ createRoot } = require('react-dom/client'))
  RN = require('react-native')
  ;({ Menu } = require('@/ui/paper.web'))
})

it('opens the existing radio menu from the keyboard, navigates and restores the trigger after selection or Escape', async () => {
  const { act, createElement, useRef, useState } = ReactActual
  jest.useFakeTimers()
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)
  const select = jest.fn()
  const viewportWidth = jest.replaceProperty(window, 'innerWidth', 250)

  const Harness = () => {
    const anchorRef = useRef<import('react-native').ViewInstance>(null)
    const [visible, setVisible] = useState(false)
    const dismiss = () => setVisible(false)
    return createElement(Menu, {
      visible,
      onDismiss: dismiss,
      keyboardAnchorRef: anchorRef,
      accessibilityLabel: 'Sort',
      anchor: createElement(RN.Pressable, { ref: anchorRef, testID: 'sort-trigger', accessibilityRole: 'button', onPress: () => setVisible(true) },
        createElement(RN.Text, null, 'Sort')),
    }, ...['Default', 'Name', 'Ratings', 'Articles'].map((title, index) => createElement(Menu.Item, {
      key: title,
      title,
      role: 'menuitemradio',
      accessibilityState: { checked: index === 0 },
      onPress: () => { select(title); dismiss() },
    })))
  }

  const key = async (target: HTMLElement, value: string) => act(async () => {
    for (const type of ['keydown', 'keyup']) target.dispatchEvent(new KeyboardEvent(type, { key: value, bubbles: true, cancelable: true }))
    // jsdom does not synthesize the browser's default Enter click for a button.
    if (value === 'Enter' && target instanceof HTMLButtonElement) target.click()
    await jest.advanceTimersByTimeAsync(34)
  })
  const active = () => document.activeElement as HTMLElement

  try {
    await act(() => root.render(createElement(Harness)))
    const trigger = container.querySelector<HTMLElement>('[data-testid="sort-trigger"]')!
    const anchor = container.querySelector<HTMLElement>('[data-testid="web-menu-anchor"]')!
    const anchorTop = window.innerHeight - 45
    jest.spyOn(anchor, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, anchorTop, 120, 44))
    trigger.focus()
    await key(trigger, 'Enter')
    await act(async () => { await jest.advanceTimersByTimeAsync(34) })
    expect(active().textContent).toBe('Default')
    expect(active().getAttribute('role')).toBe('menuitemradio')
    expect(active().getAttribute('aria-checked')).toBe('true')
    const panel = document.querySelector<HTMLElement>('[data-testid="web-menu-panel"]')!
    expect(panel.style.bottom).toBe('49px')
    expect(panel.style.width).toBe('234px')
    expect(Number.parseFloat(window.getComputedStyle(panel).minWidth) || 0).toBeLessThanOrEqual(234)
    await key(active(), 'ArrowDown')
    expect(active().textContent).toBe('Name')
    await key(active(), 'End')
    expect(active().textContent).toBe('Articles')
    await key(active(), 'Enter')
    expect(select).toHaveBeenCalledWith('Articles')
    expect(active()).toBe(trigger)

    await key(trigger, 'Enter')
    await act(async () => { await jest.advanceTimersByTimeAsync(34) })
    await key(active(), 'Escape')
    expect(document.querySelector('[role="menu"]')).toBeNull()
    expect(active()).toBe(trigger)
  } finally {
    await act(() => root.unmount())
    container.remove()
    viewportWidth.restore()
    jest.useRealTimers()
  }
})
