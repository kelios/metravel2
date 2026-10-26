/**
 * @jest-environment jsdom
 */

import type React from 'react'

/**
 * #2768: бар «Действия с путешествием» на web живёт в портале в body (#2117).
 * Портала нет в серверном HTML статьи, поэтому первый клиентский проход обязан
 * тоже отдать null — иначе гидрация серверной статьи на телефоне ловит React #418
 * и React выбрасывает всю границу статьи. Бар появляется сразу после гидрации.
 */

let createElement: typeof import('react').createElement
let act: typeof import('react').act
let hydrateRoot: typeof import('react-dom/client').hydrateRoot
let renderToString: typeof import('react-dom/server').renderToString
let Slot: React.ComponentType<Record<string, unknown>>

jest.mock('expo-router', () => ({ useIsFocused: () => true }))

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('@/components/travel/details/TravelStickyActions', () => ({
    __esModule: true,
    default: () => require('react').createElement('div', { 'data-testid': 'sticky-actions-bar' }),
  }))
  ;({ createElement, act } = require('react'))
  ;({ hydrateRoot } = require('react-dom/client'))
  // `.node`: браузерная сборка серверного рендера требует MessageChannel, которого нет в jsdom.
  ;({ renderToString } = require('react-dom/server.node'))
  Slot = require('@/components/travel/details/TravelStickyActionsSlot.web').default
}, 60_000)

const isHydrationMessage = (args: unknown[]) =>
  /hydrat|did not match|server rendered|#418|#419|#423|#425/i.test(args.map(String).join(' '))

it('серверный HTML и первый клиентский проход совпадают, бар появляется после гидрации', async () => {
  const tree = () => createElement('main', null, createElement(Slot, { travel: { id: 1 }, scrollToComments: () => {} }))
  const serverHtml = renderToString(tree())
  expect(serverHtml).toBe('<main></main>')

  const container = document.createElement('div')
  container.innerHTML = serverHtml
  document.body.appendChild(container)
  const hydrationErrors: unknown[] = []
  const consoleError = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (isHydrationMessage(args)) hydrationErrors.push(args)
  })
  let root: import('react-dom/client').Root | undefined
  try {
    await act(async () => {
      root = hydrateRoot(container, tree(), { onRecoverableError: (error) => hydrationErrors.push(error) })
    })
    expect(hydrationErrors).toEqual([])
    expect(document.body.querySelector('[data-testid="sticky-actions-bar"]')).not.toBeNull()
  } finally {
    consoleError.mockRestore()
    act(() => root?.unmount())
    container.remove()
  }
})
