/**
 * @jest-environment jsdom
 */

import type React from 'react'

/**
 * #2768: индекс заливок `utils/mediaPlaceholderIndex.ts` — модульный Map. На
 * сервере его наполняют все запросы процесса (нормализация травела в loader'е),
 * а клиент гидрирует статью по данным loader'а без этой нормализации. Если
 * рендер читает индекс напрямую, слой заливки есть в серверном HTML и нет на
 * первом клиентском проходе — React #418 выбрасывает всю границу статьи.
 * Здесь — настоящий серверный рендер react-native-web и `hydrateRoot` в обе
 * стороны расхождения индекса.
 */

let createElement: typeof import('react').createElement
let act: typeof import('react').act
let hydrateRoot: typeof import('react-dom/client').hydrateRoot
let renderToString: typeof import('react-dom/server').renderToString
let ImageCardMedia: React.ComponentType<Record<string, unknown>>
let indexMediaImage: (image: Record<string, unknown>) => void
let resetMediaPlaceholderIndex: () => void

const MANIFEST_SRC = '/travel-image/4715/conversions/thumb.webp?w=640'
const RENDERED_SRC = 'https://metravel.by/travel-image/4715/conversions/thumb.webp?w=400'
const FILL_SELECTOR = '[data-testid="card-media-data-placeholder"]'

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  ;({ createElement, act } = require('react'))
  ;({ hydrateRoot } = require('react-dom/client'))
  // `.node`: браузерная сборка серверного рендера требует MessageChannel, которого нет в jsdom.
  ;({ renderToString } = require('react-dom/server.node'))
  ImageCardMedia = require('@/components/ui/ImageCardMedia').default
  ;({ indexMediaImage, resetMediaPlaceholderIndex } = require('@/utils/mediaPlaceholderIndex'))
}, 60_000)

const isHydrationMessage = (args: unknown[]) =>
  /hydrat|did not match|server rendered|#418|#419|#423|#425/i.test(args.map(String).join(' '))

const indexThumb = () => indexMediaImage({ id: 4715, dominant_color: '#846457', src: MANIFEST_SRC })

const media = () =>
  createElement(ImageCardMedia, { testID: 'card-media', src: RENDERED_SRC, width: 56, height: 56, fit: 'cover' })

async function hydrate({ serverIndexed, clientIndexed }: { serverIndexed: boolean; clientIndexed: boolean }) {
  resetMediaPlaceholderIndex()
  if (serverIndexed) indexThumb()
  const serverHtml = renderToString(media())

  resetMediaPlaceholderIndex()
  if (clientIndexed) indexThumb()
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
      root = hydrateRoot(container, media(), { onRecoverableError: (error) => hydrationErrors.push(error) })
    })
    return { serverHtml, hydrationErrors, hasFill: container.querySelector(FILL_SELECTOR) !== null }
  } finally {
    consoleError.mockRestore()
    act(() => root?.unmount())
    container.remove()
  }
}

describe('ImageCardMedia: индекс заливок не участвует в SSR и гидрации', () => {
  it('сервер с заполненным индексом процесса, клиент с пустым: без #418', async () => {
    const { serverHtml, hydrationErrors } = await hydrate({ serverIndexed: true, clientIndexed: false })
    expect(serverHtml).not.toContain('card-media-data-placeholder')
    expect(hydrationErrors).toEqual([])
  })

  it('клиент с заполненным индексом: без #418, заливка появляется после гидрации', async () => {
    const { hydrationErrors, hasFill } = await hydrate({ serverIndexed: false, clientIndexed: true })
    expect(hydrationErrors).toEqual([])
    expect(hasFill).toBe(true)
  })
})
