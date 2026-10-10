import fs from 'node:fs'
import path from 'node:path'
import type { Root } from 'react-dom/client'
import type { QueryClient } from '@tanstack/react-query'
import type { PublicTrip } from '@/api/publicTrips'
import type { SupportedLocale } from '@/i18n/config'

/** Infrastructure inventory: config.cjs/resolver.cjs select real web modules;
 * setup.cjs supplies Winter/asset/native registries, jsdom font/CSS APIs and an
 * explicitly unavailable raster-canvas capability (actual media owner intact).
 * Only standalone router hooks/navigation context, fetch transport and the
 * deferred empty AsyncStorage restore are adapted here. The actual production
 * persisted provider/client factory/options are used; no cache is preseeded.
 * Route, catalog, API/query/UI, Head, locale and theme remain actual. This is
 * not full ExpoRoot/Metro proof.
 */
it('preserves the cold route HTML, real catalog states and locale initialization', async () => {
  const output = process.env.TRIPS_COLD_RENDER_DIR
  if (!output) throw new Error('Run through tripsColdRender.test.tsx')
  const browser = typeof document !== 'undefined'
  if (!browser) delete (globalThis as { window?: unknown }).window // Expo preset creates an incomplete native window.
  ;(globalThis as { __DEV__?: boolean }).__DEV__ = false
  Object.assign((globalThis as any).expo, require(path.resolve('node_modules/expo-modules-core/src/polyfill/CoreModule.ts')))
  jest.doMock('expo-router', () => ({
    usePathname: () => '/trips',
    useRouter: () => ({ push: () => { throw new Error('Unexpected navigation in static fixture') } }),
    useIsFocused: () => true,
    useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
  }))
  const React = require('react') as typeof import('react')
  const { renderToString } = require('react-dom/server.node') as typeof import('react-dom/server')
  const { useIsRestoring, onlineManager } = require('@tanstack/react-query') as typeof import('@tanstack/react-query')
  const { PersistQueryClientProvider } = require('@tanstack/react-query-persist-client') as typeof import('@tanstack/react-query-persist-client')
  const AsyncStorage = require('@react-native-async-storage/async-storage').default as typeof import('@react-native-async-storage/async-storage').default
  const originalStorageRead = AsyncStorage.getItem.bind(AsyncStorage)
  const restores: ((value: string | null) => void)[] = []
  const storageRead = jest.spyOn(AsyncStorage, 'getItem').mockImplementation((key, callback) => {
    if (key === 'metravel-rq-cache') return new Promise((resolve) => restores.push(resolve))
    return originalStorageRead(key, callback)
  })
  const { queryPersistenceOptions } = require('@/utils/queryPersist') as typeof import('@/utils/queryPersist')
  const { createOptimizedQueryClient } = require('@/utils/reactQueryConfig') as typeof import('@/utils/reactQueryConfig')
  const { usePublicTrips } = require('@/hooks/usePublicTripsApi') as typeof import('@/hooks/usePublicTripsApi')
  const { ThemeProvider } = require('@/hooks/useTheme') as typeof import('@/hooks/useTheme')
  const { LocaleProvider } = require('@/i18n/LocaleProvider.web') as typeof import('@/i18n/LocaleProvider.web')
  const { NavigationContext } = require('expo-router/build/react-navigation/core/NavigationContext')
  const Head = require('expo-router/head').default
  // Fresh original route payload; no await, preload, catalog replacement or
  // access to React.lazy private state occurs before the server render.
  const Route = require('@/app/(tabs)/trips/index').default
  const navigation = { isFocused: () => true, addListener: () => () => {} }
  const report: Record<string, any> = {
    provenance: 'Actual web route/catalog/RNW/providers; standalone navigation; not ExpoRoot/Metro export',
    serverFetches: 0,
    hydrationErrors: [],
    console: [],
    states: [],
    locales: [],
    queryReadiness: [],
    restoreChecks: [],
  }
  const serialize = (error: unknown) => error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { message: String(error) }
  const consoleSpies = (['error', 'warn', 'log', 'info'] as const).map((level) =>
    jest.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      report.console.push({ level, args: args.map((value) => value instanceof Error ? serialize(value) : String(value)) })
    }),
  )
  const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(() => {
    report.serverFetches += 1
    throw new Error('Server-side network request forbidden')
  })
  const clients: QueryClient[] = []
  const roots: Root[] = []
  let clock: jest.SpyInstance<number, []> | undefined
  function ReadinessProbe() {
    const result = usePublicTrips({})
    report.queryReadiness.push({
      restoring: useIsRestoring(), status: result.status, fetchStatus: result.fetchStatus,
      isPending: result.isPending, isLoading: result.isLoading, hasData: result.data !== undefined,
    })
    return null
  }
  const wrap = (client: QueryClient, head: object = {}) => React.createElement(
    Head.Provider, { context: head },
    React.createElement(NavigationContext.Provider, { value: navigation },
      React.createElement(LocaleProvider, null,
        React.createElement(ThemeProvider, null,
          React.createElement(PersistQueryClientProvider, { client, persistOptions: queryPersistenceOptions },
            React.createElement(ReadinessProbe), React.createElement(Route))))),
  )
  const makeClient = () => {
    // Same factory/root options as app/_layout.tsx; /trips is not a static
    // dictionary consumer, so the production entry disables its idle prefetch.
    const client = createOptimizedQueryClient({ mutations: { retry: false } }, { enableStaticPrefetch: false })
    clients.push(client)
    return client
  }
  try {
    let html: string
    if (!browser) {
      const head: any = {}
      html = renderToString(wrap(makeClient(), head))
      report.failedBoundaries = (html.match(/<!--\$!-->/g) ?? []).length
      report.catalog = html.includes('data-testid="public-trips-catalog"')
      report.loading = html.includes('data-testid="public-trips-loading"')
      report.empty = html.includes('data-testid="public-trips-empty"')
      report.restoreReads = storageRead.mock.calls.filter(([key]) => key === 'metravel-rq-cache').length
      report.head = { title: head.helmet?.title?.toString(), link: head.helmet?.link?.toString() }
      fs.writeFileSync(path.join(output, 'cold.html'), html)
      expect(report.failedBoundaries).toBe(0)
      expect(report.catalog).toBe(true)
      expect(report.queryReadiness[0]).toEqual({
        restoring: true, status: 'pending', fetchStatus: 'idle', isPending: true, isLoading: false, hasData: false,
      })
      expect(report.loading).toBe(true)
      expect(report.empty).toBe(false)
      expect(report.restoreReads).toBe(0)
      expect(report.head.title).toContain('Metravel')
      expect(report.head.link).toContain('rel="canonical"')
      expect(report.head.link).toContain('/trips')
      expect(report.serverFetches).toBe(0)
      return
    }

    html = fs.readFileSync(path.join(output, 'cold.html'), 'utf8')
    report.failedBoundaries = (html.match(/<!--\$!-->/g) ?? []).length
    report.catalog = html.includes('data-testid="public-trips-catalog"')
    report.loading = html.includes('data-testid="public-trips-loading"')
    const { hydrateRoot } = require('react-dom/client') as typeof import('react-dom/client')
    const i18n = require('@/i18n/instance').default as typeof import('@/i18n/instance').default
    const { loadWebLocale } = require('@/i18n/translate.web') as typeof import('@/i18n/translate.web')
    const { LOCALE_PREFERENCE_STORAGE_KEY } = require('@/i18n/localeStorage') as typeof import('@/i18n/localeStorage')
    const requests: { url: string; resolve: (response: Response) => void }[] = []
    let browserOnline = true
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => browserOnline })
    fetchSpy.mockImplementation((input, init) => new Promise<Response>((resolve, reject) => {
      const url = String(input)
      // Actual webNetworkStatus's handled HEAD reachability probe; no server
      // HTTP. A false navigator signal alone is not enough to pause queries.
      if (new URL(url).pathname === '/favicon.ico' && init?.method === 'HEAD') {
        if (!browserOnline) reject(new TypeError('Failed to fetch'))
        else resolve({ ok: true, status: 200 } as Response)
        return
      }
      if (!url.includes('/public-trips/')) throw new Error(`Unexpected fixture request ${url}`)
      requests.push({ url, resolve })
    }))
    const response = (results: unknown[], status = 200): Response => ({
      ok: status < 400,
      status,
      statusText: status < 400 ? 'OK' : 'Bad Request',
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => JSON.stringify(status < 400
        ? { count: results.length, next: null, previous: null, results }
        : { detail: 'Controlled code-level request failure' }),
    } as Response)
    const dto = {
      id: 99001, owner: 99552, owner_profile: { id: 99552, name: 'Fixture organizer' },
      title: 'Cold route fixture trip', start_at: '2030-06-15T09:00:00+03:00',
      transport_mode: 'walk', seats_count: 4, start_point_name: 'Fixture region',
    }
    const until = async (predicate: () => boolean, label: string) => {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        if (predicate()) return
        await React.act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
      }
      throw new Error(`Fixture condition not reached: ${label}`)
    }
    const hydrate = async (locale: SupportedLocale, theme: 'light' | 'dark', offline = false) => {
      await i18n.changeLanguage('ru')
      await loadWebLocale(locale) // Same locale preload as entry.js; not a route/lazy preload.
      localStorage.clear()
      localStorage.setItem(LOCALE_PREFERENCE_STORAGE_KEY, JSON.stringify({ version: 1, mode: 'explicit', locale }))
      localStorage.setItem('theme', theme)
      const container = document.createElement('div')
      document.body.appendChild(container)
      container.innerHTML = html
      const client = makeClient()
      let root!: Root
      await React.act(async () => {
        root = hydrateRoot(container, wrap(client), {
          onRecoverableError: (error) => report.hydrationErrors.push({ kind: 'recoverable', ...serialize(error) }),
          onCaughtError: (error) => report.hydrationErrors.push({ kind: 'caught', ...serialize(error) }),
          onUncaughtError: (error) => report.hydrationErrors.push({ kind: 'uncaught', ...serialize(error) }),
        })
      })
      roots.push(root)
      await until(() => restores.length > 0, `${locale}/${theme} storage restore held`)
      expect(requests).toHaveLength(0)
      expect(container.querySelector('[data-testid="public-trips-loading"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="public-trips-empty"]')).toBeNull()
      expect(container.querySelector('[data-testid="public-trips-search-input"]')).toBeNull()
      expect(report.queryReadiness[report.queryReadiness.length - 1]).toEqual({
        restoring: true, status: 'pending', fetchStatus: 'idle', isPending: true, isLoading: false, hasData: false,
      })
      report.restoreChecks.push({ locale, theme, held: true, requests: requests.length })
      await React.act(async () => { restores.shift()!(null) })
      await until(() => i18n.resolvedLanguage === locale && (offline
        ? report.queryReadiness.some((state: { restoring: boolean; fetchStatus: string }) => !state.restoring && state.fetchStatus === 'paused')
        : requests.length > 0), `${locale}/${theme} initialized`)
      expect(container.querySelector('[data-testid="public-trips-loading"]')).not.toBeNull()
      expect(document.documentElement.lang).toBe(locale)
      expect(document.documentElement.getAttribute('data-theme')).toBe(theme)
      expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toContain('/trips')
      return { client, container, root }
    }
    const instance = await hydrate('ru', 'light')
    report.states.push('loading')
    await React.act(async () => { requests.shift()!.resolve(response([dto])) })
    await until(() => !!instance.container.querySelector('[data-testid="trip-card-99001"]'), 'real mapped card')
    report.states.push('populated')
    const search = instance.container.querySelector('[data-testid="public-trips-search-input"]') as HTMLInputElement
    await React.act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'no such fixture')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await until(() => !!instance.container.querySelector('[data-testid="public-trips-reset-empty"]'), 'filtered empty')
    report.states.push('filtered-empty')
    await React.act(async () => {
      const button = instance.container.querySelector('[data-testid="public-trips-reset-empty"]') as HTMLElement
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await until(() => !!instance.container.querySelector('[data-testid="trip-card-99001"]'), 'reset restores card')
    report.states.push('reset')
    // Supported browser reconnect causes the actual query owner to refetch.
    const reconnect = async () => {
      await React.act(async () => {
        browserOnline = false
        window.dispatchEvent(new Event('offline'))
        await Promise.resolve()
      })
      await React.act(async () => {
        browserOnline = true
        window.dispatchEvent(new Event('online'))
      })
      await until(() => requests.length > 0, 'reconnect refetch')
    }
    // The five-minute cached value is fresh; normal reconnect does not refresh
    // it yet. The fixture advances the query's public clock to its stale point.
    clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 6 * 60 * 1000)
    await reconnect()
    await React.act(async () => { requests.shift()!.resolve(response([])) })
    await until(() => !!instance.container.querySelector('[data-testid="public-trips-empty"]'), 'true API empty')
    expect(instance.container.querySelector('[data-testid="public-trips-search-input"]')).toBeNull()
    expect(instance.container.querySelector('[data-testid="public-trips-reset-empty"]')).toBeNull()
    report.states.push('empty')
    clock.mockReturnValue(Date.now() + 6 * 60 * 1000)
    await reconnect()
    await React.act(async () => { requests.shift()!.resolve(response([], 400)) })
    await until(() => instance.container.textContent?.includes('Не удалось загрузить каталог') === true, 'rendered actual query request error')
    expect(instance.client.getQueryCache().getAll().some((query) => query.state.status === 'error')).toBe(true)
    expect(instance.container.querySelector('[data-testid="public-trips-empty"]')).toBeNull()
    expect(instance.container.textContent).toContain('Не удалось загрузить каталог')
    report.states.push('error')
    await reconnect()
    await React.act(async () => { requests.shift()!.resolve(response([dto])) })
    await until(() => !!instance.container.querySelector('[data-testid="trip-card-99001"]'), 'reconnect recovery')
    expect(instance.client.getQueryCache().getAll()[0].state.data as PublicTrip[]).toEqual(expect.arrayContaining([expect.objectContaining({ id: dto.id, title: dto.title })]))
    report.states.push('recovery')

    // Cached confirmed data stays readable offline. Changing the actual filter
    // then creates a genuinely unknown paused key; it must not look empty or
    // inherit the previous key's card/control state.
    await React.act(async () => {
      browserOnline = false
      window.dispatchEvent(new Event('offline'))
    })
    await until(() => !onlineManager.isOnline(), 'actual web reachability source offline')
    expect(instance.container.querySelector('[data-testid="trip-card-99001"]')).not.toBeNull()
    const region = instance.container.querySelector('[data-testid="trip-filter-region"]') as HTMLSelectElement
    await React.act(async () => {
      region.value = dto.start_point_name
      region.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await until(() => !!instance.container.querySelector('[data-testid="public-trips-loading"]'), 'unknown offline filter key')
    const paused = instance.client.getQueryCache().getAll().find((query) =>
      (query.queryKey[1] as { region?: string })?.region === dto.start_point_name,
    )
    expect(paused?.state).toEqual(expect.objectContaining({ status: 'pending', fetchStatus: 'paused', data: undefined }))
    expect(instance.container.querySelector('[data-testid="public-trips-empty"]')).toBeNull()
    expect(instance.container.querySelector('[data-testid="public-trips-search-input"]')).toBeNull()
    expect(instance.container.querySelector('[data-testid="trip-card-99001"]')).toBeNull()
    expect(requests).toHaveLength(0)
    report.states.push('offline-new-key-pending')
    await React.act(async () => {
      browserOnline = true
      window.dispatchEvent(new Event('online'))
    })
    await until(() => requests.length > 0, 'offline new key resumes actual request')
    await React.act(async () => { requests.shift()!.resolve(response([dto])) })
    await until(() => !!instance.container.querySelector('[data-testid="trip-card-99001"]'), 'offline new key confirmed')
    report.states.push('offline-new-key-recovery')
    clock.mockRestore()
    clock = undefined
    await React.act(async () => instance.root.unmount())
    roots.splice(roots.indexOf(instance.root), 1)
    instance.client.clear()
    instance.container.remove()
    requests.splice(0)
    for (const locale of ['ru', 'be', 'uk', 'pl', 'en'] as SupportedLocale[]) {
      for (const theme of ['light', 'dark'] as const) {
        const localized = await hydrate(locale, theme)
        await React.act(async () => localized.root.unmount())
        roots.splice(roots.indexOf(localized.root), 1)
        localized.client.clear()
        localized.container.remove()
        requests.splice(0)
      }
      report.locales.push(locale)
    }
    // Cold offline with no successful cached value remains pending after the
    // real storage restore finishes; reconnect is the supported retry path.
    browserOnline = false
    const offline = await hydrate('ru', 'light', true)
    expect(requests).toHaveLength(0)
    expect(offline.container.querySelector('[data-testid="public-trips-empty"]')).toBeNull()
    expect(offline.container.querySelector('[data-testid="public-trips-search-input"]')).toBeNull()
    report.states.push('offline-cold-pending')
    await React.act(async () => {
      browserOnline = true
      window.dispatchEvent(new Event('online'))
    })
    await until(() => requests.length > 0, 'cold offline reconnect request')
    await React.act(async () => { requests.shift()!.resolve(response([])) })
    await until(() => !!offline.container.querySelector('[data-testid="public-trips-empty"]'), 'cold offline real empty')
    report.states.push('offline-cold-recovery')
    expect(report.hydrationErrors).toEqual([])
    expect(report.console.filter((event: { level: string }) => event.level === 'error')).toEqual([])
    expect(report.serverFetches).toBe(0)
  } catch (error) {
    report.thrown = serialize(error)
    throw error
  } finally {
    clock?.mockRestore()
    for (const root of roots) await React.act(async () => root.unmount())
    for (const client of clients) client.clear()
    fs.writeFileSync(path.join(output, browser ? 'jsdom.json' : 'node.json'), JSON.stringify(report, null, 2))
    fetchSpy.mockRestore()
    for (const restore of restores) restore(null)
    storageRead.mockRestore()
    for (const spy of consoleSpies) spy.mockRestore()
  }
}, 40_000)
