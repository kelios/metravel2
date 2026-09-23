import type React from 'react'
import type { Root } from 'react-dom/client'

// #2035: `onBlur` ссылки пропуска читает `document.activeElement.dataset.skipLink`,
// чтобы переход Tab на соседнюю ссылку не прятал блок. Маркер стоял сырым пропом
// `data-skip-link`, который react-native-web в DOM не переносит, — блок исчезал
// под фокусом на второй ссылке. Здесь — настоящий DOM react-native-web (рецепт
// `CompactSideBarTravel.dom.web.test.tsx`).
let act: typeof import('react').act
let createElement: typeof import('react').createElement
let createRoot: typeof import('react-dom/client').createRoot
let SkipLinks: React.ComponentType<any>

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  ;({ act, createElement } = require('react'))
  ;({ createRoot } = require('react-dom/client'))
  SkipLinks = require('@/components/layout/SkipLinks').default
})

describe('SkipLinks in the real React Native Web DOM (#2035)', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root.render(createElement(SkipLinks))
    })
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  const flushBlurCheck = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

  it('keeps the block visible while Tab moves from one skip link to the next', async () => {
    const links = Array.from(container.querySelectorAll<HTMLElement>('[tabindex="0"]'))
    expect(links).toHaveLength(2)
    expect(links.map((link) => link.getAttribute('data-skip-link'))).toEqual(['true', 'true'])
    const block = links[0].parentElement as HTMLElement
    const hiddenClassName = block.className

    await act(async () => links[0].focus())
    await flushBlurCheck()
    const visibleClassName = block.className
    expect(visibleClassName).not.toBe(hiddenClassName)

    await act(async () => links[1].focus())
    await flushBlurCheck()
    expect(document.activeElement).toBe(links[1])
    expect(block.className).toBe(visibleClassName)

    await act(async () => links[1].blur())
    await flushBlurCheck()
    expect(block.className).toBe(hiddenClassName)
  })
})
