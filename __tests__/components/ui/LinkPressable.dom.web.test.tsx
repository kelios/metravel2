import type React from 'react'
import type { Root } from 'react-dom/client'

// #2901: плашки hero на проде уходили в полную перезагрузку вместо SPA-перехода.
// `Link onPress asChild` + `Pressable`: Link кладёт свой `onPress` из `...rest` поверх
// навигационного, а `onClick` Link затирает Pressable из react-native-web. В итоге
// никто не зовёт `preventDefault`, и браузер идёт по `href`. Здесь — настоящий DOM
// react-native-web, настоящий Slot из expo-router и сборка пропсов как в
// `BaseExpoRouterLink` (web-ветка), чтобы тест ловил именно этот механизм.
let act: typeof import('react').act
let createElement: typeof import('react').createElement
let createRoot: typeof import('react-dom/client').createRoot
let Pressable: typeof import('react-native').Pressable
let Text: typeof import('react-native').Text
let LinkMock: React.ComponentType<any>
let LinkPressable: React.ComponentType<any>
let NavigationLink: typeof import('@/components/ui/NavigationLink').default
let shouldHandleLinkClick: (event: unknown) => boolean

const mockPush = jest.fn()
const mockLinkTo = jest.fn()

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('expo-router', () => {
    const ReactLib = jest.requireActual('react')
    const { Slot } = jest.requireActual('expo-router/build/ui/Slot')
    // expo-router `shouldHandleMouseEvent` (web): только обычный левый клик.
    const shouldHandle = (e: any) => {
      if (e?.defaultPrevented) return false
      if ('button' in e && !e.metaKey && !e.altKey && !e.ctrlKey && !e.shiftKey
        && (e.button == null || e.button === 0)
        && [undefined, null, '', 'self'].includes(e.currentTarget.target)) {
        e.preventDefault()
        return true
      }
      return false
    }
    const Link = ({ href, asChild: _asChild, style, ...rest }: any) => {
      const props = { href, role: 'link', onPress: (e: any) => { if (shouldHandle(e)) mockLinkTo(href) } }
      const onPress = (e: any) => {
        if ('onPress' in rest) rest.onPress?.(e)
        props.onPress(e)
      }
      return ReactLib.createElement(Slot, { ...props, ...rest, style, onClick: onPress })
    }
    return { __esModule: true, Link, router: { push: mockPush } }
  })
  ;({ act, createElement } = require('react'))
  ;({ createRoot } = require('react-dom/client'))
  ;({ Pressable, Text } = require('react-native'))
  LinkMock = require('expo-router').Link
  const linkPressableModule = require('@/components/ui/LinkPressable')
  LinkPressable = linkPressableModule.default
  shouldHandleLinkClick = linkPressableModule.shouldHandleLinkClick
  NavigationLink = require('@/components/ui/NavigationLink').default
})

describe('LinkPressable in the real React Native Web DOM (#2901)', () => {
  let container: HTMLDivElement
  let root: Root

  const render = async (element: React.ReactElement) => {
    await act(async () => {
      root.render(element)
    })
  }

  const anchor = () => {
    const node = container.querySelector('a')
    expect(node).not.toBeNull()
    return node as HTMLAnchorElement
  }

  // `true` — браузер выполнил бы действие по умолчанию, то есть перешёл бы по `href`.
  const click = async (init: MouseEventInit = {}) => {
    let followsHref = false
    await act(async () => {
      followsHref = anchor().dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }),
      )
    })
    return followsHref
  }

  const renderLink = (onPress?: (event: any) => void, style?: unknown) =>
    render(
      createElement(
        LinkPressable,
        { href: '/search', onPress, style, testID: 'link' },
        createElement(Text, null, 'За 2 минуты'),
      ),
    )

  beforeEach(() => {
    mockPush.mockClear()
    mockLinkTo.mockClear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('reproduces the defect: Link onPress + direct Pressable child follows href', async () => {
    const onPress = jest.fn()
    await render(
      createElement(
        LinkMock,
        { href: '/search', onPress, asChild: true },
        createElement(Pressable, { accessibilityRole: 'link' }, createElement(Text, null, 'x')),
      ),
    )
    expect(await click()).toBe(true)
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(mockLinkTo).not.toHaveBeenCalled()
  })

  it('keeps a real anchor and navigates in-app once on a plain left click', async () => {
    const onPress = jest.fn()
    await renderLink(onPress, [{ borderWidth: 1 }, { borderColor: 'red' }])
    expect(anchor().getAttribute('href')).toBe('/search')
    expect(anchor().getAttribute('role') ?? 'link').toBe('link')

    expect(await click()).toBe(false)
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith('/search')
    expect(mockLinkTo).not.toHaveBeenCalled()
  })

  it('navigates once for keyboard Enter (the browser turns it into a click on the anchor)', async () => {
    await renderLink()
    await act(async () => {
      anchor().focus()
      anchor().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
      anchor().dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true, cancelable: true }))
    })
    expect(await click()).toBe(false)
    expect(mockPush).toHaveBeenCalledTimes(1)
  })

  it.each([{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { button: 1 }])(
    'leaves modified click %j to the browser',
    async (init) => {
      const onPress = jest.fn()
      await renderLink(onPress)
      expect(await click(init)).toBe(true)
      expect(mockPush).not.toHaveBeenCalled()
      expect(mockLinkTo).not.toHaveBeenCalled()
    },
  )

  it('runs custom navigation only for an unmodified link activation', async () => {
    const onNavigate = jest.fn()
    await render(createElement(NavigationLink, {
      href: '/search',
      onNavigate,
      selected: true,
      dataSet: { travelNavActive: 'true' },
    }, 'Маршруты'))

    expect(anchor().getAttribute('href')).toBe('/search')
    expect(anchor().getAttribute('aria-current')).toBe('page')
    expect(anchor().dataset.navigationLink).toBe('true')
    expect(anchor().dataset.travelNavActive).toBe('true')
    expect(await click({ ctrlKey: true })).toBe(true)
    expect(onNavigate).not.toHaveBeenCalled()
    expect(await click()).toBe(false)
    expect(onNavigate).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockLinkTo).not.toHaveBeenCalled()
  })

  it('does not navigate when the caller prevented default', async () => {
    const onPress = jest.fn((event: { preventDefault: () => void }) => event.preventDefault())
    await renderLink(onPress)
    expect(await click()).toBe(false)
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockLinkTo).not.toHaveBeenCalled()
  })

  it('keeps the governed external destination available for modified clicks', async () => {
    const onNavigate = jest.fn()
    await render(createElement(NavigationLink, {
      external: true,
      href: 'https://example.org/route',
      onNavigate,
    }, 'Маршрут'))

    expect(anchor().getAttribute('href')).toBe('https://example.org/route')
    expect(anchor().target).toBe('_blank')
    expect(anchor().rel).toBe('noopener')
    expect(await click({ metaKey: true })).toBe(true)
    expect(onNavigate).not.toHaveBeenCalled()
    expect(await click()).toBe(false)
    expect(onNavigate).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('does not render an unsafe external destination', async () => {
    await render(createElement(NavigationLink, { external: true, href: 'javascript:alert(1)' }, 'Маршрут'))
    expect(container.querySelector('a')).toBeNull()
  })

  it('treats target=_blank and nativeEvent modifiers as browser navigation', () => {
    const base = { button: 0, defaultPrevented: false, preventDefault: jest.fn() }
    expect(shouldHandleLinkClick({ ...base, currentTarget: { target: '' } })).toBe(true)
    expect(shouldHandleLinkClick({ ...base, currentTarget: { target: '_blank' } })).toBe(false)
    expect(shouldHandleLinkClick({ ...base, nativeEvent: { ctrlKey: true } })).toBe(false)
    expect(shouldHandleLinkClick({ ...base, defaultPrevented: true })).toBe(false)
  })
})
