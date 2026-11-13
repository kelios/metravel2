import type React from 'react'
import type { QueryClient as QueryClientType } from '@tanstack/react-query'
import type { Root } from 'react-dom/client'

let react: typeof import('react')
let createRoot: typeof import('react-dom/client').createRoot
let hydrateRoot: typeof import('react-dom/client').hydrateRoot
let renderToString: typeof import('react-dom/server').renderToString
let QueryClient: typeof import('@tanstack/react-query').QueryClient
let QueryClientProvider: typeof import('@tanstack/react-query').QueryClientProvider
let useTravelDetails: typeof import('@/hooks/useTravelDetails').useTravelDetails
let useResponsive: typeof import('@/hooks/useResponsive').useResponsive
let Shell: typeof import('@/components/travel/details/TravelDetailsCriticalShell').default
let LoadingFallback: typeof import('@/components/travel/details/TravelDetailsLoadingFallback').default
let LoaderContext: typeof import('@/components/travel/details/travelLoaderData').TravelLoaderDataContext
let normalizeTravelItem: typeof import('@/api/travelsNormalize').normalizeTravelItem
let Animated: typeof import('react-native').Animated
let waitFor: typeof import('@testing-library/react').waitFor
let originalFetch: typeof globalThis.fetch
const roots: { root: Root; host: HTMLElement; client: QueryClientType }[] = []
const slug = 'e2e-real-preload-hydration'
const rawTravel = {
  id: 791, slug, name: 'Hydration fixture', description: '<p>Article body.</p>',
  gallery: [], travelAddress: [], coordsMeTravel: [], countryName: 'Беларусь',
  userName: 'Автор', userIds: [], publish: true, moderation: true,
}
const preloadKeys = [
  '__metravelTravelPreload', '__metravelTravelPreloadPending',
  '__metravelTravelPreloadPromise', '__metravelTravelPreloadTargetPath',
  '__metravelTravelPreloadScriptLoaded',
] as const
type PreloadWindow = Window & typeof globalThis & Partial<Record<typeof preloadKeys[number], unknown>>
const savedGlobals = new Map<string, unknown>()

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('expo-router', () => ({
    useLocalSearchParams: () => ({ param: slug }),
    useIsFocused: () => true,
    router: { push: jest.fn() },
  }))
  jest.doMock('@/hooks/useTheme', () => ({
    useThemedColors: () => require('@/constants/designSystem').getThemedColors(false),
  }))
  // These heavy child boundaries are outside the preload/readiness mechanism.
  // Keep the shell's actual structural branches, title and skeleton intact.
  jest.doMock('@/components/travel/CompactSideBarTravel', () => () => null)
  jest.doMock('@/components/travel/details/TravelHeroSlots', () => ({
    TravelHeroFavoriteToggleSlot: () => null,
  }))
  jest.doMock('@/components/travel/details/TravelDetailsHeroDeferredColumn', () => {
    const React = require('react')
    return {
      TravelDetailsHeroBlock: ({ titleSlot }: { titleSlot: React.ReactNode }) =>
        React.createElement(React.Fragment, null, titleSlot),
      TravelDetailsContentBlock: () => null,
    }
  })
  react = require('react')
  ;({ createRoot, hydrateRoot } = require('react-dom/client'))
  ;({ renderToString } = require('react-dom/server.node'))
  ;({ QueryClient, QueryClientProvider } = require('@tanstack/react-query'))
  ;({ useTravelDetails } = require('@/hooks/useTravelDetails'))
  ;({ useResponsive } = require('@/hooks/useResponsive'))
  ;({ TravelLoaderDataContext: LoaderContext } = require('@/components/travel/details/travelLoaderData'))
  ;({ normalizeTravelItem } = require('@/api/travelsNormalize'))
  ;({ Animated } = require('react-native'))
  ;({ waitFor } = require('@testing-library/react/pure'))
  Shell = require('@/components/travel/details/TravelDetailsCriticalShell').default
  LoadingFallback = require('@/components/travel/details/TravelDetailsLoadingFallback').default
  originalFetch = globalThis.fetch
  for (const key of preloadKeys) savedGlobals.set(key, (window as PreloadWindow)[key])
})

beforeEach(() => {
  for (const key of preloadKeys) delete (window as PreloadWindow)[key]
  globalThis.fetch = jest.fn(async () => ({
    ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => rawTravel, text: async () => JSON.stringify(rawTravel),
  } as Response))
})

afterEach(async () => {
  for (const { root, host, client } of roots.splice(0)) {
    await react.act(async () => root.unmount())
    host.remove()
    client.clear()
  }
})

afterAll(() => {
  globalThis.fetch = originalFetch
  for (const key of preloadKeys) {
    const saved = savedGlobals.get(key)
    if (saved === undefined) delete (window as PreloadWindow)[key]
    else (window as PreloadWindow)[key] = saved
  }
})

type Commit = {
  hasTravel: boolean
  hasInitialPreloadedTravel: boolean
  isLoading: boolean
  isError: boolean
  name: string | null
  width: number
}
function DataShell({ commits }: { commits: Commit[] }) {
  const data = useTravelDetails()
  const { width } = useResponsive()
  react.useLayoutEffect(() => {
    commits.push({
      hasTravel: Boolean(data.travel),
      hasInitialPreloadedTravel: data.hasInitialPreloadedTravel,
      isLoading: data.isLoading,
      isError: data.isError,
      name: data.travel?.name ?? null,
      width,
    })
  })
  return react.createElement(Shell, {
    travel: data.travel, isMobile: width < 768, screenWidth: width,
    wrapperStyle: {}, styles: {}, skeletonPhase: 'loading',
    skeletonFallback: react.createElement(LoadingFallback),
    scrollRef: { current: null }, scrollViewStyle: {},
    scrollEventHandler: () => {}, handleContentSizeChange: () => {}, handleLayout: () => {},
    contentHorizontalPadding: 16, anchors: {}, onFirstImageLoad: () => {},
    sectionLinks: [], onQuickJump: () => {}, deferHeroExtras: true,
    forceOpenKey: null, activeSection: null, closeMenu: () => {}, onNavigate: () => {},
    menuWidthNum: 320, animatedX: new Animated.Value(0), sideMenuPlatformStyles: {},
    deferredContent: null, mainAriaLabel: 'Travel article',
  })
}

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
}

function tree(client: QueryClientType, commits: Commit[], loader = false) {
  const travel = normalizeTravelItem(rawTravel)
  return react.createElement(QueryClientProvider, { client },
    react.createElement(LoaderContext.Provider, {
      value: loader ? {
        routeKey: slug, travel, mediaPartial: false, serverDescriptionSanitized: false,
      } : null,
    }, react.createElement(DataShell, { commits })),
  )
}

function genericDocument() {
  const server = makeClient()
  const html = renderToString(tree(server, []))
  server.clear()
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  expect(host.querySelector('[data-testid="travel-details-title"]')).toBeNull()
  expect(host.querySelector('[data-testid="travel-details-loading"]')).not.toBeNull()
  expect(host.querySelector('[data-router-ssr="travel"]')).toBeNull()
  return host
}

function finishPreload() {
  ;(window as PreloadWindow).__metravelTravelPreload = {
    data: rawTravel, slug, isId: false, source: 'direct-api',
  }
}

it('hydrates a generic loading document when direct-api preload wins before the first render', async () => {
  const host = genericDocument()
  finishPreload()
  const client = makeClient()
  const commits: Commit[] = []
  const errors: unknown[] = []
  let root: Root | undefined
  await react.act(async () => {
    root = hydrateRoot(host, tree(client, commits), { onRecoverableError: error => errors.push(error) })
  })
  roots.push({ root: root!, host, client })
  expect(errors.map(error => error instanceof Error ? error.message : String(error))).toEqual([])
  expect(commits[0]).toMatchObject({
    hasTravel: false, hasInitialPreloadedTravel: false, isLoading: true, isError: false, width: 0,
  })
  expect(commits.at(-1)).toMatchObject({
    hasTravel: true, hasInitialPreloadedTravel: true, name: rawTravel.name, isLoading: false,
  })
  expect(globalThis.fetch).not.toHaveBeenCalled()
})

it('hydrates the same loaded shell when the data was actually serialized through the server loader', async () => {
  const server = makeClient()
  const host = document.createElement('div')
  host.innerHTML = renderToString(tree(server, [], true))
  server.clear()
  document.body.appendChild(host)
  const client = makeClient()
  const commits: Commit[] = []
  const errors: unknown[] = []
  let root: Root | undefined
  await react.act(async () => {
    root = hydrateRoot(host, tree(client, commits, true), { onRecoverableError: error => errors.push(error) })
  })
  roots.push({ root: root!, host, client })
  expect(commits[0]).toMatchObject({ hasTravel: true, width: 0 })
  expect(errors).toEqual([])
})

it('keeps synchronous preload available for a client-only mount with no server document', async () => {
  finishPreload()
  const client = makeClient()
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  roots.push({ root, host, client })
  const commits: Commit[] = []
  await react.act(async () => root.render(tree(client, commits)))
  expect(commits[0]).toMatchObject({ hasTravel: true, hasInitialPreloadedTravel: true })
  expect(globalThis.fetch).not.toHaveBeenCalled()
})

it('hydrates generic loading before a late direct-api preload arrives', async () => {
  const host = genericDocument()
  let resolvePreload!: () => void
  ;(window as PreloadWindow).__metravelTravelPreloadTargetPath = `/travels/${slug}`
  ;(window as PreloadWindow).__metravelTravelPreloadScriptLoaded = true
  ;(window as PreloadWindow).__metravelTravelPreloadPending = true
  ;(window as PreloadWindow).__metravelTravelPreloadPromise = new Promise<void>(resolve => {
    resolvePreload = resolve
  })
  const client = makeClient()
  const commits: Commit[] = []
  const errors: unknown[] = []
  let root: Root | undefined
  await react.act(async () => {
    root = hydrateRoot(host, tree(client, commits), { onRecoverableError: error => errors.push(error) })
  })
  roots.push({ root: root!, host, client })
  expect(commits[0]).toMatchObject({ hasTravel: false, width: 0 })
  expect(errors).toEqual([])
  await react.act(async () => {
    finishPreload()
    ;(window as PreloadWindow).__metravelTravelPreloadPending = false
    resolvePreload()
  })
  await waitFor(() => expect(host.querySelector('[data-testid="travel-details-title"]')?.textContent).toBe(rawTravel.name))
  expect(errors).toEqual([])
  expect(globalThis.fetch).not.toHaveBeenCalled()
})

it('hydrates the serialized loader snapshot even when a newer client cache is already populated', async () => {
  const server = makeClient()
  const host = document.createElement('div')
  host.innerHTML = renderToString(tree(server, [], true))
  server.clear()
  document.body.appendChild(host)
  const client = makeClient()
  const { queryKeys } = require('@/api/queryKeys') as typeof import('@/api/queryKeys')
  client.setQueryData(queryKeys.travel(slug), {
    ...normalizeTravelItem(rawTravel), name: 'Client cache arrived first',
  })
  const commits: Commit[] = []
  const errors: unknown[] = []
  let root: Root | undefined
  await react.act(async () => {
    root = hydrateRoot(host, tree(client, commits, true), { onRecoverableError: error => errors.push(error) })
  })
  roots.push({ root: root!, host, client })
  expect(commits[0]).toMatchObject({
    hasTravel: true, hasInitialPreloadedTravel: true, name: rawTravel.name,
    isLoading: false, isError: false, width: 0,
  })
  expect(errors).toEqual([])
})

it('keeps generic SSR loading coherent when only a client query cache wins before hydration', async () => {
  const host = genericDocument()
  const client = makeClient()
  const { queryKeys } = require('@/api/queryKeys') as typeof import('@/api/queryKeys')
  client.setQueryData(queryKeys.travel(slug), normalizeTravelItem(rawTravel))
  const commits: Commit[] = []
  const errors: unknown[] = []
  let root: Root | undefined
  await react.act(async () => {
    root = hydrateRoot(host, tree(client, commits), { onRecoverableError: error => errors.push(error) })
  })
  roots.push({ root: root!, host, client })
  expect(commits[0]).toMatchObject({
    hasTravel: false, hasInitialPreloadedTravel: false, name: null,
    isLoading: true, isError: false, width: 0,
  })
  expect(commits.at(-1)?.name).toBe(rawTravel.name)
  expect(errors).toEqual([])
  expect(globalThis.fetch).not.toHaveBeenCalled()
})
