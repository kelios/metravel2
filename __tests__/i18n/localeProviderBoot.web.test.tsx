/**
 * #2239 (`I18N-LOCALE-BOOT-REMOUNT-001`): сохранённая не русская локаль не
 * перемонтирует приложение при старте web.
 *
 * Тест повторяет прод-путь: статический русский HTML (#938) → hydrateRoot. До
 * исправления экран монтировался дважды (русская гидратация + перемонтирование
 * ключом после загрузки каталога), и стартовый запрос уходил дважды.
 */
import React, { act, createContext, useContext, useEffect, useState } from 'react'
import { MessageChannel as NodeMessageChannel } from 'node:worker_threads'
import { hydrateRoot, type Root } from 'react-dom/client'

// Серверный рендер react-dom в jsdom требует MessageChannel, которого в jsdom нет.
// Порт узлового канала держит event loop: без закрытия `jest --runInBand`
// (`npm run test:i18n`) не завершался после прогона. Каналы, созданные
// планировщиком React, не держат процесс (`unref`) и закрываются в `afterAll`.
const openedChannels: NodeMessageChannel[] = []
class TestMessageChannel extends NodeMessageChannel {
  constructor() {
    super()
    this.port1.unref()
    this.port2.unref()
    openedChannels.push(this)
  }
}
const installedMessageChannel = typeof globalThis.MessageChannel === 'undefined'
if (installedMessageChannel) {
  ;(globalThis as { MessageChannel?: unknown }).MessageChannel = TestMessageChannel
}
afterAll(() => {
  for (const channel of openedChannels.splice(0)) {
    channel.port1.close()
    channel.port2.close()
  }
  if (installedMessageChannel) delete (globalThis as { MessageChannel?: unknown }).MessageChannel
})
const { renderToString } = require('react-dom/server') as typeof import('react-dom/server')

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => globalThis.localStorage.getItem(key)),
    setItem: jest.fn(async (key: string, value: string) => globalThis.localStorage.setItem(key, value)),
  },
}))
jest.mock('@/i18n/instance', () => jest.requireActual('@/i18n/instance.web'))
jest.mock('@/i18n/translate', () => ({
  loadWebLocale: jest.fn(),
  translate: jest.fn((value: unknown) => String(value)),
}))

type Deferred = { promise: Promise<void>; resolve: () => void; reject: (error: Error) => void }
const createDeferred = (): Deferred => {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

const STORAGE_KEY = '@metravel/locale-preference:v1'

// Один экземпляр модулей на файл: `jest.resetModules` дал бы провайдеру свою
// копию React. Состояние языка сбрасывается в `beforeEach`.
const i18n = (require('@/i18n/instance') as typeof import('@/i18n/instance.web')).default
const { LocaleProvider, useLocale } =
  require('@/i18n/LocaleProvider.web') as typeof import('@/i18n/LocaleProvider.web')
const { loadWebLocale } = require('@/i18n/translate') as { loadWebLocale: jest.Mock }
const loadProvider = () => ({ i18n, LocaleProvider, useLocale, loadWebLocale })

describe('LocaleProvider.web boot with a stored locale (#2239)', () => {
  let container: HTMLDivElement
  let root: Root | null
  let recoverableErrors: unknown[]
  let consoleError: jest.SpyInstance

  beforeEach(async () => {
    await i18n.changeLanguage('ru')
    loadWebLocale.mockReset()
    document.documentElement.lang = 'ru'
    window.localStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = null
    recoverableErrors = []
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(async () => {
    await act(async () => root?.unmount())
    container.remove()
    consoleError.mockRestore()
  })

  const setup = (stored: string | null) => {
    const modules = loadProvider()
    const mounts: string[] = []
    const Screen = ({ label = 'screen' }: { label?: string }) => {
      useEffect(() => {
        // Аналог стартового запроса экрана: ровно один на монтирование.
        mounts.push(String(modules.i18n.resolvedLanguage))
      }, [])
      return <p>{`${label}:${modules.i18n.resolvedLanguage}`}</p>
    }
    // Статический HTML собирается без сохранённой локали, как на сервере.
    const serverHtml = renderToString(
      <modules.LocaleProvider>
        <Screen />
      </modules.LocaleProvider>,
    )
    container.innerHTML = serverHtml
    if (stored) window.localStorage.setItem(STORAGE_KEY, stored)
    const hydrate = async (element: React.ReactElement) => {
      await act(async () => {
        root = hydrateRoot(container, element, {
          onRecoverableError: (error) => recoverableErrors.push(error),
        })
      })
    }
    return { ...modules, Screen, mounts, serverHtml, hydrate }
  }

  const hydrationErrors = () =>
    consoleError.mock.calls.filter((call) => /hydrat|did not match|#418|#419/i.test(String(call[0])))

  it('keeps the static HTML until the catalogue loads, then mounts the screen once in Polish', async () => {
    const { LocaleProvider, Screen, mounts, loadWebLocale, hydrate } = setup(
      JSON.stringify({ version: 1, mode: 'explicit', locale: 'pl' }),
    )
    const catalogue = createDeferred()
    loadWebLocale.mockReturnValue(catalogue.promise)

    await hydrate(
      <LocaleProvider>
        <Screen />
      </LocaleProvider>,
    )
    expect(mounts).toEqual([])
    expect(container.textContent).toBe('screen:ru')

    await act(async () => catalogue.resolve())

    expect(loadWebLocale).toHaveBeenCalledWith('pl')
    expect(mounts).toEqual(['pl'])
    expect(container.textContent).toBe('screen:pl')
    expect(document.documentElement.lang).toBe('pl')
    expect(recoverableErrors).toEqual([])
    expect(hydrationErrors()).toEqual([])
  })

  it('ignores parent re-renders while the locale is pending, so the screen still mounts once', async () => {
    const { LocaleProvider, Screen, mounts, loadWebLocale, hydrate } = setup(
      JSON.stringify({ version: 1, mode: 'explicit', locale: 'en' }),
    )
    const catalogue = createDeferred()
    loadWebLocale.mockReturnValue(catalogue.promise)
    let rerenderParent: () => void = () => {}
    const Parent = () => {
      const [, setTick] = useState(0)
      rerenderParent = () => setTick((tick) => tick + 1)
      return (
        <LocaleProvider>
          <Screen />
        </LocaleProvider>
      )
    }

    await hydrate(<Parent />)
    await act(async () => rerenderParent())
    expect(mounts).toEqual([])
    expect(container.textContent).toBe('screen:ru')

    await act(async () => catalogue.resolve())
    expect(mounts).toEqual(['en'])
    expect(container.textContent).toBe('screen:en')
    expect(recoverableErrors).toEqual([])
  })

  it('never blanks the page when a context above changes before the catalogue loads', async () => {
    const { LocaleProvider, Screen, mounts, loadWebLocale, hydrate } = setup(
      JSON.stringify({ version: 1, mode: 'explicit', locale: 'uk' }),
    )
    const catalogue = createDeferred()
    loadWebLocale.mockReturnValue(catalogue.promise)
    const OuterContext = createContext(0)
    const Reader = () => {
      useContext(OuterContext)
      return <Screen />
    }
    let bumpOuter: () => void = () => {}
    const Outer = () => {
      const [value, setValue] = useState(0)
      bumpOuter = () => setValue((current) => current + 1)
      return (
        <OuterContext.Provider value={value}>
          <LocaleProvider>
            <Reader />
          </LocaleProvider>
        </OuterContext.Provider>
      )
    }

    await hydrate(<Outer />)
    await act(async () => bumpOuter())
    // Худший случай — прежнее поведение (русские дети на месте), но не пустой кадр.
    expect(container.textContent).toBe('screen:ru')

    await act(async () => catalogue.resolve())
    expect(container.textContent).toBe('screen:uk')
    expect(mounts[mounts.length - 1]).toBe('uk')
    expect(mounts.length).toBeLessThanOrEqual(2)
    expect(recoverableErrors).toEqual([])
    expect(hydrationErrors()).toEqual([])
  })

  it('hydrates immediately for the Russian default without loading a catalogue', async () => {
    const { LocaleProvider, Screen, mounts, loadWebLocale, hydrate } = setup(null)

    await hydrate(
      <LocaleProvider>
        <Screen />
      </LocaleProvider>,
    )
    await act(async () => {})

    expect(mounts).toEqual(['ru'])
    expect(loadWebLocale).not.toHaveBeenCalled()
    expect(container.textContent).toBe('screen:ru')
    expect(recoverableErrors).toEqual([])
  })

  it('falls back to the Russian tree, mounted once, when the catalogue fails to load', async () => {
    const { LocaleProvider, Screen, mounts, loadWebLocale, hydrate } = setup(
      JSON.stringify({ version: 1, mode: 'explicit', locale: 'be' }),
    )
    loadWebLocale.mockRejectedValue(new Error('chunk failed'))

    await hydrate(
      <LocaleProvider>
        <Screen />
      </LocaleProvider>,
    )
    await act(async () => {})

    expect(mounts).toEqual(['ru'])
    expect(container.textContent).toBe('screen:ru')
    expect(recoverableErrors).toEqual([])
    expect(hydrationErrors()).toEqual([])
  })

  it('still remounts on an explicit language change by the user', async () => {
    const { LocaleProvider, useLocale, Screen, mounts, loadWebLocale, hydrate } = setup(null)
    loadWebLocale.mockResolvedValue(undefined)
    let setLocale: (locale: 'en') => Promise<void> = async () => {}
    const Capture = () => {
      setLocale = useLocale().setLocale
      return null
    }

    await hydrate(
      <LocaleProvider>
        <Capture />
        <Screen />
      </LocaleProvider>,
    )
    await act(async () => {})
    await act(async () => setLocale('en'))

    expect(mounts).toEqual(['ru', 'en'])
    expect(container.textContent).toBe('screen:en')
  })
})
