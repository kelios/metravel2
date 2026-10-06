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
jest.mock('@/i18n/bootLocale', () => jest.requireActual('@/i18n/bootLocale.web'))
jest.mock('@/i18n/translate', () => ({
  isWebLocaleLoaded: jest.fn(),
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

import { getLocaleBootCss, getLocaleBootScript, LOCALE_BOOT_PENDING_CLASS, releaseLocaleBootShell } from '@/i18n/localeBootShell'

const STORAGE_KEY = '@metravel/locale-preference:v1'

// Один экземпляр модулей на файл: `jest.resetModules` дал бы провайдеру свою
// копию React. Состояние языка сбрасывается в `beforeEach`.
const i18n = (require('@/i18n/instance') as typeof import('@/i18n/instance.web')).default
const { LocaleProvider, useLocale } =
  require('@/i18n/LocaleProvider.web') as typeof import('@/i18n/LocaleProvider.web')
const { prepareBootLocale } = require('@/i18n/bootLocale') as typeof import('@/i18n/bootLocale.web')
const { isWebLocaleLoaded, loadWebLocale } = require('@/i18n/translate') as {
  isWebLocaleLoaded: jest.Mock
  loadWebLocale: jest.Mock
}
const loadProvider = () => ({ i18n, LocaleProvider, useLocale, loadWebLocale })

describe('LocaleProvider.web boot with a stored locale (#2239)', () => {
  let container: HTMLDivElement
  let root: Root | null
  let recoverableErrors: unknown[]
  let consoleError: jest.SpyInstance

  beforeEach(async () => {
    await i18n.changeLanguage('ru')
    loadWebLocale.mockReset()
    // По умолчанию каталог к гидратации не загружен (асинхронный путь).
    isWebLocaleLoaded.mockReset()
    isWebLocaleLoaded.mockImplementation((locale: string) => locale === 'ru')
    document.documentElement.lang = 'ru'
    document.documentElement.classList.remove(LOCALE_BOOT_PENDING_CLASS)
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
    document.getElementById('test-locale-boot-css')?.remove()
    consoleError.mockRestore()
  })

  const setup = (stored: string | null) => {
    const modules = loadProvider()
    const mounts: string[] = []
    const Screen = ({ label = 'screen' }: { label?: string }) => {
      const { isHydrated } = modules.useLocale()
      useEffect(() => {
        // Аналог стартового запроса экрана: ровно один на монтирование.
        mounts.push(String(modules.i18n.resolvedLanguage))
      }, [])
      return <p data-locale-hydrated={String(isHydrated)}>{`${label}:${modules.i18n.resolvedLanguage}`}</p>
    }
    // Статический HTML собирается без сохранённой локали, как на сервере.
    const serverHtml = renderToString(
      <modules.LocaleProvider>
        <Screen />
      </modules.LocaleProvider>,
    )
    container.innerHTML = serverHtml
    if (stored) window.localStorage.setItem(STORAGE_KEY, stored)
    new Function(getLocaleBootScript())()
    const style = document.createElement('style')
    style.id = 'test-locale-boot-css'
    style.textContent = getLocaleBootCss()
    document.head.appendChild(style)
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

  const failChunk = (name = 'locale-pl-broken.js') => {
    window.__metravelReloadStaleChunk = jest.fn(() => false)
    const script = document.createElement('script')
    script.src = `${window.location.origin}/_expo/static/js/web/${name}`
    document.body.appendChild(script)
    script.dispatchEvent(new Event('error'))
    script.remove()
  }

  it('mounts the screen once in Polish when contexts above change right after hydration (prod order)', async () => {
    // Прод (приёмка 06.10.2026): над `LocaleProvider` стоят провайдеры
    // expo-router, их значения меняются в эффектах сразу после гидратации —
    // кадр окна `SafeAreaProvider`, состояние навигации. Смена контекста выше
    // негидратированной границы заставляла React отрисовать её клиентом с
    // `fallback` (русские дети, стартовый запрос), а после загрузки каталога
    // дерево монтировалось второй раз: 2 запроса, 2 монтирования.
    const { LocaleProvider, Screen, mounts, loadWebLocale, hydrate } = setup(
      JSON.stringify({ version: 1, mode: 'explicit', locale: 'pl' }),
    )
    const loaded = new Set<string>(['ru'])
    loadWebLocale.mockImplementation(async (locale: string) => {
      loaded.add(locale)
    })
    isWebLocaleLoaded.mockImplementation((locale: string) => loaded.has(locale))
    const FrameContext = createContext({ width: 0 })
    const NavigationStateContext = createContext({ index: -1 })
    const Reader = () => {
      useContext(FrameContext)
      useContext(NavigationStateContext)
      return <Screen />
    }
    const ExpoRouterRoot = ({ children }: { children: React.ReactNode }) => {
      const [frame, setFrame] = useState({ width: 0 })
      const [navigation, setNavigation] = useState({ index: -1 })
      useEffect(() => {
        setFrame({ width: 1440 })
        setNavigation({ index: 0 })
      }, [])
      return (
        <FrameContext.Provider value={frame}>
          <NavigationStateContext.Provider value={navigation}>{children}</NavigationStateContext.Provider>
        </FrameContext.Provider>
      )
    }

    // Как `entry.js`: каталог сохранённой локали — до `hydrateRoot`.
    const ready = prepareBootLocale()
    expect(ready).not.toBeNull()
    await ready
    expect(loadWebLocale).toHaveBeenCalledWith('pl')

    await hydrate(
      <ExpoRouterRoot>
        <LocaleProvider>
          <Reader />
        </LocaleProvider>
      </ExpoRouterRoot>,
    )
    await act(async () => {})

    expect(mounts).toEqual(['pl'])
    expect(container.textContent).toBe('screen:pl')
    expect(document.documentElement.lang).toBe('pl')
    expect(loadWebLocale).toHaveBeenCalledTimes(1)
    expect(recoverableErrors).toEqual([])
    expect(hydrationErrors()).toEqual([])
  })

  it.each(['pl', 'en', 'be', 'uk'])('hides the Russian SSG frame before any app script for %s, then reveals one translated mount', async (locale) => {
    const { LocaleProvider, Screen, mounts, hydrate } = setup(JSON.stringify({ version: 1, mode: 'explicit', locale }))
    const catalogue = createDeferred()
    loadWebLocale.mockReturnValue(catalogue.promise)
    expect(container.textContent).toBe('screen:ru') // SEO HTML remains intact.
    expect(getComputedStyle(container.querySelector('p')!).visibility).toBe('hidden')
    await hydrate(<LocaleProvider><Screen /></LocaleProvider>)
    expect(mounts).toEqual([])
    await act(async () => catalogue.resolve())
    expect(mounts).toEqual([locale])
    expect(container.textContent).toBe(`screen:${locale}`)
    expect(getComputedStyle(container.querySelector('p')!).visibility).toBe('visible')
  })

  it.each([null, '{invalid', JSON.stringify({ version: 1, mode: 'explicit', locale: 'ru' }), JSON.stringify({ version: 1, mode: 'explicit', locale: 'xx' })])('keeps Russian SSR visible for default or invalid preference %s', (stored) => {
    setup(stored)
    expect(document.documentElement.classList.contains(LOCALE_BOOT_PENDING_CLASS)).toBe(false)
    expect(getComputedStyle(container.querySelector('p')!).visibility).toBe('visible')
  })

  it('prepares nothing before hydration without a stored non-Russian locale', () => {
    expect(prepareBootLocale()).toBeNull()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, mode: 'explicit', locale: 'ru' }))
    expect(prepareBootLocale()).toBeNull()
    expect(loadWebLocale).not.toHaveBeenCalled()
  })

  it('starts the app even when the catalogue fails to load before hydration', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, mode: 'explicit', locale: 'en' }))
    loadWebLocale.mockRejectedValue(new Error('chunk failed'))

    await expect(prepareBootLocale()).resolves.toBeUndefined()
    expect(loadWebLocale).toHaveBeenCalledWith('en')
  })

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

  it('keeps Russian screens unmounted when an outer context changes during boot', async () => {
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
    expect(container.textContent).toBe('')
    expect(mounts).toEqual([])
    expect(document.documentElement.classList.contains(LOCALE_BOOT_PENDING_CLASS)).toBe(true)

    await act(async () => catalogue.resolve())
    expect(container.textContent).toBe('screen:uk')
    expect(mounts[mounts.length - 1]).toBe('uk')
    expect(mounts).toEqual(['uk'])
    expect(document.documentElement.classList.contains(LOCALE_BOOT_PENDING_CLASS)).toBe(false)
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

  it('shows Belarusian recovery controls without mounting a Russian screen when the catalogue fails', async () => {
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

    expect(mounts).toEqual([])
    expect(container.textContent).toContain('Не ўдалося загрузіць мову інтэрфейсу.')
    const serverScreen = Array.from(container.querySelectorAll('p')).find((element) => element.textContent === 'screen:ru')!
    expect(getComputedStyle(serverScreen).visibility).toBe('hidden')
    expect(getComputedStyle(container.querySelector('#locale-boot-recovery p')!).visibility).toBe('visible')
    const fallback = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Працягнуць па-руску')!
    await act(async () => fallback.click())
    expect(mounts).toEqual(['ru'])
    expect(container.textContent).toBe('screen:ru')
    expect(container.querySelector('[data-locale-hydrated]')?.getAttribute('data-locale-hydrated')).toBe('true')
    expect(document.documentElement.classList.contains(LOCALE_BOOT_PENDING_CLASS)).toBe(false)
    expect(recoverableErrors).toEqual([])
    expect(hydrationErrors()).toEqual([])
  })

  it('keeps an explicit Russian fallback when the original slow catalogue resolves later', async () => {
    jest.useFakeTimers()
    try {
      const { LocaleProvider, Screen, mounts, hydrate } = setup(JSON.stringify({ version: 1, mode: 'explicit', locale: 'pl' }))
      const catalogue = createDeferred()
      loadWebLocale.mockReturnValue(catalogue.promise)
      await hydrate(<LocaleProvider><Screen /></LocaleProvider>)
      await act(async () => { jest.advanceTimersByTime(3001) })
      expect(mounts).toEqual([])
      expect(container.textContent).toContain('Ładowanie języka interfejsu…')
      const fallback = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Kontynuuj po rosyjsku')!
      await act(async () => fallback.click())
      expect(mounts).toEqual(['ru'])
      expect(container.querySelector('[data-locale-hydrated]')?.getAttribute('data-locale-hydrated')).toBe('true')
      await act(async () => catalogue.resolve())
      expect(mounts).toEqual(['ru'])
      expect(i18n.resolvedLanguage).toBe('ru')
      expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual({ version: 1, mode: 'explicit', locale: 'ru' })
    } finally { jest.useRealTimers() }
  })

  it('provides Polish recovery after the guarded retry if the React entry script fails', () => {
    setup(JSON.stringify({ version: 1, mode: 'explicit', locale: 'pl' }))
    window.__metravelReloadStaleChunk = jest.fn(() => false)
    const script = document.createElement('script')
    script.src = `${window.location.origin}/_expo/static/js/web/entry-broken.js`
    document.body.appendChild(script)
    script.dispatchEvent(new Event('error'))
    const status = document.querySelector('#locale-boot-recovery [role="status"]')!
    expect(status.textContent).toBe('Nie udało się załadować języka interfejsu.')
    expect(getComputedStyle(status).visibility).toBe('visible')
    expect(window.__metravelReloadStaleChunk).toHaveBeenCalled()
    const fallback = Array.from(document.querySelectorAll('#locale-boot-recovery button')).find((button) => button.textContent === 'Kontynuuj po rosyjsku')! as HTMLButtonElement
    fallback.click()
    expect(document.documentElement.classList.contains(LOCALE_BOOT_PENDING_CLASS)).toBe(false)
    script.remove()
    delete window.__metravelReloadStaleChunk
  })

  it('hands pre-React chunk recovery to the provider without an overlapping panel after catalogue rejection', async () => {
    const { LocaleProvider, Screen, mounts, hydrate } = setup(JSON.stringify({ version: 1, mode: 'explicit', locale: 'pl' }))
    const catalogue = createDeferred()
    loadWebLocale.mockReturnValue(catalogue.promise)
    failChunk()
    expect(document.querySelectorAll('[data-static-recovery="true"]')).toHaveLength(1)
    await hydrate(<LocaleProvider><Screen /></LocaleProvider>)
    expect(window.__metravelLocaleBootRecoveryOwner).toBe('react')
    expect(document.querySelectorAll('[data-static-recovery="true"]')).toHaveLength(0)
    // A later failed chunk cannot reclaim the recovery surface from React.
    failChunk()
    expect(document.querySelectorAll('[data-static-recovery="true"]')).toHaveLength(0)
    await act(async () => catalogue.reject(new Error('catalogue blocked')))
    const panels = document.querySelectorAll('#locale-boot-recovery')
    expect(panels).toHaveLength(1)
    expect(panels[0].querySelectorAll('button')).toHaveLength(2)
    const fallback = Array.from(panels[0].querySelectorAll('button')).find((button) => button.textContent === 'Kontynuuj po rosyjsku')!
    expect(getComputedStyle(fallback).visibility).toBe('visible')
    expect(getComputedStyle(fallback).pointerEvents).toBe('auto')
    expect(getComputedStyle(panels[0]).position).toBe('fixed')
    await act(async () => fallback.click())
    expect(document.querySelectorAll('#locale-boot-recovery')).toHaveLength(0)
    expect(document.documentElement.classList.contains(LOCALE_BOOT_PENDING_CLASS)).toBe(false)
    expect(mounts).toEqual(['ru'])
    expect(i18n.resolvedLanguage).toBe('ru')
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual({ version: 1, mode: 'explicit', locale: 'ru' })
    expect(recoverableErrors).toEqual([])
    expect(hydrationErrors()).toEqual([])
    delete window.__metravelReloadStaleChunk
  })

  it('keeps one clickable provider recovery and RU mount when a late locale chunk resolves after the handoff', async () => {
    jest.useFakeTimers()
    try {
      const { LocaleProvider, Screen, mounts, hydrate } = setup(JSON.stringify({ version: 1, mode: 'explicit', locale: 'pl' }))
      const catalogue = createDeferred()
      loadWebLocale.mockReturnValue(catalogue.promise)
      failChunk('providers-broken.js')
      await hydrate(<LocaleProvider><Screen /></LocaleProvider>)
      await act(async () => { jest.advanceTimersByTime(3001) })
      failChunk()
      expect(document.querySelectorAll('#locale-boot-recovery')).toHaveLength(1)
      expect(document.querySelectorAll('[data-static-recovery="true"]')).toHaveLength(0)
      const fallback = Array.from(document.querySelectorAll('#locale-boot-recovery button')).find((button) => button.textContent === 'Kontynuuj po rosyjsku')! as HTMLButtonElement
      expect(getComputedStyle(fallback).visibility).toBe('visible')
      expect(getComputedStyle(fallback).pointerEvents).toBe('auto')
      await act(async () => fallback.click())
      await act(async () => catalogue.resolve())
      expect(mounts).toEqual(['ru'])
      expect(i18n.resolvedLanguage).toBe('ru')
      expect(document.querySelectorAll('#locale-boot-recovery')).toHaveLength(0)
      expect(recoverableErrors).toEqual([])
      expect(hydrationErrors()).toEqual([])
    } finally {
      delete window.__metravelReloadStaleChunk
      jest.useRealTimers()
    }
  })

  it('preserves an explicit static RU choice made before the provider arrives', async () => {
    const { LocaleProvider, Screen, mounts, hydrate } = setup(JSON.stringify({ version: 1, mode: 'explicit', locale: 'pl' }))
    const catalogue = createDeferred()
    loadWebLocale.mockReturnValue(catalogue.promise)
    const prepared = prepareBootLocale()
    failChunk()
    const fallback = Array.from(document.querySelectorAll('#locale-boot-recovery button')).find((button) => button.textContent === 'Kontynuuj po rosyjsku')! as HTMLButtonElement
    fallback.click()
    await hydrate(<LocaleProvider><Screen /></LocaleProvider>)
    await act(async () => catalogue.resolve())
    await prepared
    expect(mounts).toEqual(['ru'])
    expect(i18n.resolvedLanguage).toBe('ru')
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual({ version: 1, mode: 'explicit', locale: 'ru' })
    expect(document.querySelectorAll('#locale-boot-recovery')).toHaveLength(0)
    expect(recoverableErrors).toEqual([])
    expect(hydrationErrors()).toEqual([])
    delete window.__metravelReloadStaleChunk
  })

  it('cancels a queued head recovery when the boot shell is released before the body becomes available', () => {
    setup(JSON.stringify({ version: 1, mode: 'explicit', locale: 'pl' }))
    window.__metravelReloadStaleChunk = jest.fn(() => false)
    // A resource may fail in <head>, before document.body exists.
    Object.defineProperty(document, 'body', { configurable: true, value: null })
    try {
      window.dispatchEvent(new ErrorEvent('error', { filename: `${window.location.origin}/_expo/static/js/web/entry-broken.js` }))
    } finally {
      Reflect.deleteProperty(document, 'body')
    }
    releaseLocaleBootShell()
    document.dispatchEvent(new Event('DOMContentLoaded'))
    expect(document.querySelectorAll('#locale-boot-recovery')).toHaveLength(0)
    expect(document.documentElement.classList.contains(LOCALE_BOOT_PENDING_CLASS)).toBe(false)
    delete window.__metravelReloadStaleChunk
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
