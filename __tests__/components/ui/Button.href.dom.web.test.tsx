import type React from 'react'

// #3231: `href` у Button — настоящая ссылка на web только для безопасного
// внешнего адреса и только у активной кнопки.
let createElement: typeof import('react').createElement
let renderToStaticMarkup: typeof import('react-dom/server').renderToStaticMarkup
let Button: React.ComponentType<any>

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  ;({ createElement } = require('react'))
  ;({ renderToStaticMarkup } = require('react-dom/server.node'))
  Button = require('@/components/ui/Button').default
})

const render = (props: Record<string, unknown>) => {
  const host = document.createElement('div')
  host.innerHTML = renderToStaticMarkup(createElement(Button, { label: 'Store', onPress: () => {}, ...props }))
  return host
}

it('renders an external https href as a new-tab link', () => {
  const link = render({ href: 'https://apps.apple.com/app/id6801264369' }).querySelector('a')
  expect(link?.getAttribute('href')).toBe('https://apps.apple.com/app/id6801264369')
  expect(link?.getAttribute('target')).toBe('_blank')
  expect(link?.getAttribute('rel')).toContain('noopener')
})

it.each([
  ['an unsafe scheme', { href: 'javascript:alert(1)' }],
  ['a relative path', { href: '/app' }],
  ['a disabled button', { href: 'https://apps.apple.com/app/id6801264369', disabled: true }],
  ['a loading button', { href: 'https://apps.apple.com/app/id6801264369', loading: true }],
])('stays a plain button for %s', (_name, props) => {
  const host = render(props)
  expect(host.querySelector('a')).toBeNull()
  expect(host.querySelector('[role="button"]')).not.toBeNull()
})

describe('clicks on a link button', () => {
  let act: typeof import('react').act
  let createRoot: typeof import('react-dom/client').createRoot
  let container: HTMLDivElement
  let root: import('react-dom/client').Root
  const onPress = jest.fn()
  const onHrefFollow = jest.fn()

  beforeAll(() => {
    ;({ act } = require('react'))
    ;({ createRoot } = require('react-dom/client'))
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  })

  beforeEach(async () => {
    onPress.mockClear()
    onHrefFollow.mockClear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root.render(createElement(Button, {
        label: 'Store', href: 'https://apps.apple.com/app/id6801264369', onPress, onHrefFollow,
      }))
    })
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  const click = (init: MouseEventInit) => {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...init })
    act(() => { container.querySelector('a')!.dispatchEvent(event) })
    return event
  }

  it('hands a plain click to onPress and stops the browser navigation', () => {
    const event = click({})
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(onHrefFollow).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })

  it('leaves a modified click to the browser and reports it', () => {
    const event = click({ ctrlKey: true })
    expect(onPress).not.toHaveBeenCalled()
    expect(onHrefFollow).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(false)
  })
})
