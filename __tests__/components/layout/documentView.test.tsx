import React, { useLayoutEffect } from 'react'
import { Platform, Text } from 'react-native'
import { act, render } from '@testing-library/react-native'
import { DocumentViewProvider, getDocumentPresentation, isBookHydrationScreen, isDeniedEditorScreen, isNotFoundRoute, isNotFoundScreen, useRootDocumentView, type DocumentView } from '@/components/layout/documentView'
import RootDocumentStack from '@/components/layout/RootDocumentStack'

type TestRoute = { key: string; name: string; params?: object; state?: { index?: number; routes: TestRoute[] } }
let mockRootRoute: TestRoute
let mockRootFocused = true
let mockRegistrationFrames: boolean[] = []
const mockRootNotFound = jest.fn()

jest.mock('expo-router', () => {
  const ReactActual = jest.requireActual('react') as typeof React
  const { Text: NativeText } = jest.requireActual('react-native')
  const Stack = ({ children, screenLayout }: { children: React.ReactNode; screenLayout?: (props: object) => React.ReactNode }) => screenLayout
    ? screenLayout({
      children,
      route: { key: mockRootRoute.key, name: mockRootRoute.name },
      navigation: { getState: () => ({ routes: [mockRootRoute] }) },
    }) : children
  function Screen() {
    const registrationOnly = require('@/components/layout/documentView').useDocumentRouteRegistration() as boolean
    ReactActual.useLayoutEffect(() => { mockRegistrationFrames.push(registrationOnly) })
    return ReactActual.createElement(NativeText, { testID: registrationOnly ? 'tabs-registration' : 'book-leaf' }, registrationOnly ? 'registration only' : 'book route')
  }
  Stack.Screen = Screen
  return { Stack, useIsFocused: () => mockRootFocused }
})
jest.mock('@/components/screens/NotFoundScreen', () => ({
  __esModule: true,
  default: () => {
    mockRootNotFound()
    const ReactActual = jest.requireActual('react')
    return ReactActual.createElement(jest.requireActual('react-native').Text, { testID: 'root-not-found' }, 'delivered 404')
  },
}))

function Probe({ pathname, segments = [], onCommit }: { pathname: string; segments?: string[]; onCommit?: (view: DocumentView) => void }) {
  const view = useRootDocumentView(pathname, segments)
  useLayoutEffect(() => { onCommit?.(view) }, [view, onCommit])
  return <Text testID="view">{JSON.stringify({ ...view, ...getDocumentPresentation(view) })}</Text>
}

function RootProbe({ pathname }: { pathname: string }) {
  const view = useRootDocumentView(pathname, [])
  return <DocumentViewProvider value={view}><RootDocumentStack /></DocumentViewProvider>
}

describe('delivered document ownership (#2701)', () => {
  const originalPlatform = Platform.OS
  let marker: HTMLDivElement
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    mockRootRoute = { key: 'tabs', name: '(tabs)', state: { index: 0, routes: [{ key: 'book', name: 'books/[slug]', params: { slug: 'unknown' } }] } }
    mockRootFocused = true
    mockRegistrationFrames = []
    mockRootNotFound.mockClear()
    marker = document.createElement('div'); marker.id = 'static-not-found'; document.body.appendChild(marker)
  })
  afterEach(() => { marker.remove(); Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform }) })

  it.each(['/travel/42', '/travel/0', '/travel/000123', '/travel/9007199254740993'])('uses the delivered marker at numeric server route %s', async pathname => {
    window.history.replaceState(null, '', pathname)
    const screen = await render(<Probe pathname={pathname} />)
    expect(JSON.parse(screen.getByTestId('view').props.children)).toMatchObject({ kind: 'not-found', pathname, showFooter: true, prefetchTravelStatics: false })
  })

  it.each(['/travel/new', '/travel/slug', '/travel/-1', '/travel/42/extra', '/travels/42', '/search'])('does not redefine unrelated matched route %s', async pathname => {
    window.history.replaceState(null, '', pathname)
    const screen = await render(<Probe pathname={pathname} />)
    expect(JSON.parse(screen.getByTestId('view').props.children).kind).toBe('route')
  })

  it('does not read a marker inserted later by an SPA route', async () => {
    window.history.replaceState(null, '', '/travel/42')
    marker.remove()
    const screen = await render(<Probe pathname="/travel/42" />)
    document.body.appendChild(marker)
    await await screen.rerender(<Probe pathname="/travel/42" />)
    expect(JSON.parse(screen.getByTestId('view').props.children)).toMatchObject({ kind: 'route', showFooter: false, prefetchTravelStatics: true })
  })

  it('retains denial through rerenders and consumes it permanently after a committed departure', async () => {
    window.history.replaceState(null, '', '/travel/42')
    const readMarker = jest.spyOn(document, 'getElementById')
    const screen = await render(<Probe pathname="/travel/42" />)
    marker.remove()
    await await screen.rerender(<Probe pathname="/travel/42" />)
    expect(JSON.parse(screen.getByTestId('view').props.children).kind).toBe('not-found')
    await act(async () => await await screen.rerender(<Probe pathname="/" />))
    expect(JSON.parse(screen.getByTestId('view').props.children)).toMatchObject({ kind: 'route', pathname: '/' })
    await await screen.rerender(<Probe pathname="/travel/42" />)
    expect(JSON.parse(screen.getByTestId('view').props.children)).toMatchObject({ kind: 'route', pathname: '/travel/42', showFooter: false, prefetchTravelStatics: true })
    expect(readMarker).toHaveBeenCalledTimes(1)
    readMarker.mockRestore()
  })

  it.each(['android', 'ios'])('is inert on %s even with a web marker and matching route', async platform => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: platform })
    window.history.replaceState(null, '', '/travel/42')
    const screen = await render(<Probe pathname="/travel/42" segments={['+not-found']} />)
    expect(JSON.parse(screen.getByTestId('view').props.children).kind).toBe('route')
  })

  it.each(['[...missing]', '+not-found'])('recognizes generic %s and preserves supported locale quest routes', segment => {
    expect(isNotFoundRoute('/+not-found', [segment])).toBe(true)
    expect(isNotFoundRoute('/unmatched', [segment])).toBe(true)
    for (const locale of ['be', 'uk', 'pl', 'en']) expect(isNotFoundRoute(`/${locale}/quests/4/minsk-cmok`, [segment])).toBe(false)
    expect(isNotFoundRoute('/pl/quests/no-city', [segment])).toBe(true)
  })

  it('classifies a new root descriptor before its SceneView can commit route info', () => {
    expect(isNotFoundScreen({ name: '[...missing]', params: { missing: ['unknown'] } })).toBe(true)
    expect(isNotFoundScreen({ name: '+not-found' })).toBe(true)
    expect(isNotFoundScreen({ name: '(tabs)' })).toBe(false)
    for (const locale of ['be', 'uk', 'pl', 'en']) expect(isNotFoundScreen({ name: '[...missing]', params: { missing: [locale, 'quests', '4', 'minsk-cmok'] } })).toBe(false)
  })

  it('keeps healthy editor/new prefetch and normal map/travel presentation', () => {
    for (const pathname of ['/travel/42', '/travel/new']) expect(getDocumentPresentation({ kind: 'route', pathname })).toMatchObject({ prefetchTravelStatics: true, showFooter: false })
    expect(getDocumentPresentation({ kind: 'route', pathname: '/map' }).isMapRoute).toBe(true)
    expect(getDocumentPresentation({ kind: 'route', pathname: '/travels/example' }).isTravelRoute).toBe(true)
    for (const pathname of ['/map', '/travels/example', '/roulette']) expect(getDocumentPresentation({ kind: 'not-found', pathname })).toEqual({ showFooter: true, prefetchTravelStatics: false, isTravelRoute: false, isMapRoute: false, hasMapBackground: false })
  })

  it('binds the bootstrap override to its own currently focused editor leaf, never a stale global NotFound view', () => {
    const route = (name: string, id = '42') => ({ name: '(tabs)', state: { index: 0, routes: [{ name, params: { id } }] } })
    for (const id of ['42', '0', '000123', '9007199254740993']) expect(isDeniedEditorScreen(`/travel/${id}`, route('travel/[id]', id))).toBe(true)
    expect(isDeniedEditorScreen(undefined, route('travel/[id]'))).toBe(false)
    expect(isDeniedEditorScreen('/travel/42', route('index'))).toBe(false)
    expect(isDeniedEditorScreen('/travel/42', route('travel/new'))).toBe(false)
    expect(isDeniedEditorScreen('/travel/42', route('travel/[id]', '43'))).toBe(false)
  })

  it.each([
    ['/books/unknown', '/books/unknown'],
    ['/books/%D0%BC%D1%96%D1%80', '/books/мір'],
    ['/books/one%2Ftwo', '/books/one/two'],
    ['/books/100%25', '/books/100%'],
  ])('uses delivered book URI %s with Expo pathname %s for only the hydration frame', async (delivered, resolved) => {
    window.history.replaceState(null, '', delivered)
    const frames: DocumentView[] = []
    await render(<Probe pathname={resolved} onCommit={view => { frames.push(view) }} />)
    expect(frames[0]).toEqual({ kind: 'not-found', pathname: resolved, bookHydrationPathname: delivered })
    expect(frames[frames.length - 1]).toEqual({ kind: 'route', pathname: resolved })
  })

  it('does not adopt a malformed escaped book URI as a document hint', async () => {
    window.history.replaceState(null, '', '/books/%invalid')
    const frames: DocumentView[] = []
    await render(<Probe pathname="/books/%invalid" onCommit={view => { frames.push(view) }} />)
    expect(frames[0]).toEqual({ kind: 'route', pathname: '/books/%invalid' })
  })

  it('does not bootstrap a healthy book or adopt a marker inserted after mount', async () => {
    window.history.replaceState(null, '', '/books/unknown')
    marker.remove()
    const frames: DocumentView[] = [], onCommit = (view: DocumentView) => { frames.push(view) }
    const screen = await render(<Probe pathname="/books/unknown" onCommit={onCommit} />)
    document.body.appendChild(marker)
    await screen.rerender(<Probe pathname="/books/unknown" onCommit={onCommit} />)
    expect(frames.length).toBeGreaterThan(0)
    expect(frames.every(view => view.kind === 'route' && view.bookHydrationPathname === undefined)).toBe(true)
  })

  it.each(['/books', '/books/', '/books/unknown/extra', '/other/unknown'])('does not bootstrap the unrelated delivered route %s', async pathname => {
    window.history.replaceState(null, '', pathname)
    const frames: DocumentView[] = []
    await render(<Probe pathname={pathname} onCommit={view => { frames.push(view) }} />)
    expect(frames[0]).toEqual({ kind: 'route', pathname })
  })

  it('classifies the actual focused nested book slug, never a cached book or stale root descriptor', () => {
    const activeBook: TestRoute = { key: 'book', name: 'books/[slug]', params: { slug: 'unknown' } }
    const catalog: TestRoute = { key: 'catalog', name: 'books/index' }
    const tabs = (index: number): TestRoute => ({ key: 'tabs', name: '(tabs)', state: { index, routes: [activeBook, catalog] } })
    expect(isBookHydrationScreen('/books/unknown', tabs(0))).toBe(true)
    expect(isBookHydrationScreen('/books/unknown', { key: 'root', name: 'root', state: { routes: [tabs(0)] } })).toBe(true)
    expect(isBookHydrationScreen('/books/unknown', tabs(1))).toBe(false)
    expect(isBookHydrationScreen('/books/another', tabs(0))).toBe(false)
    expect(isBookHydrationScreen('/books/%D0%BC%D1%96%D1%80', { ...activeBook, params: { slug: 'мір' } })).toBe(true)
    expect(isBookHydrationScreen('/books/%invalid', activeBook)).toBe(false)
    expect(isBookHydrationScreen(undefined, tabs(0))).toBe(false)
    for (const params of [undefined, { id: 'unknown' }, { slug: ['unknown'] }]) {
      expect(isBookHydrationScreen('/books/unknown', { ...activeBook, params })).toBe(false)
    }
    expect(isBookHydrationScreen('/books/unknown', { key: 'tabs', name: '(tabs)', state: { index: 2, routes: [activeBook] } })).toBe(false)
  })

  it.each([
    ['/books/unknown', 'unknown'],
    ['/books/%D0%BC%D1%96%D1%80', 'мір'],
    ['/books/one%2Ftwo', 'one/two'],
    ['/books/100%25', '100%'],
  ])('registers Tabs behind the delivered root 404 at %s, then releases its decoded leaf', async (delivered, slug) => {
    window.history.replaceState(null, '', delivered)
    mockRootRoute.state!.routes[0].params = { slug }
    const pathname = `/books/${slug}`
    const screen = await render(<RootProbe pathname={pathname} />)
    expect(mockRegistrationFrames).toEqual([true, false])
    expect(mockRootNotFound).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('root-not-found')).toBeNull()
    expect(screen.getByTestId('book-leaf')).toBeTruthy()
    await screen.rerender(<RootProbe pathname="/books" />)
    await screen.rerender(<RootProbe pathname={pathname} />)
    expect(mockRootNotFound).toHaveBeenCalledTimes(1)
    expect(mockRegistrationFrames.slice(1).every(value => value === false)).toBe(true)
  })

  it('keeps a marker-free book in the leaf from its first root frame', async () => {
    window.history.replaceState(null, '', '/books/unknown')
    marker.remove()
    const screen = await render(<RootProbe pathname="/books/unknown" />)
    expect(mockRegistrationFrames).toEqual([false])
    expect(mockRootNotFound).not.toHaveBeenCalled()
    expect(screen.getByTestId('book-leaf')).toBeTruthy()
  })

  it('binds root bootstrap to screen focus and its active leaf rather than the global document kind', async () => {
    const view: DocumentView = { kind: 'not-found', pathname: '/books/unknown', bookHydrationPathname: '/books/unknown' }
    mockRootFocused = false
    const screen = await render(<DocumentViewProvider value={view}><RootDocumentStack /></DocumentViewProvider>)
    expect(screen.queryByTestId('root-not-found')).toBeNull()
    mockRootFocused = true
    mockRootRoute.state!.routes.push({ key: 'catalog', name: 'books/index' })
    mockRootRoute.state!.index = 1
    await screen.rerender(<DocumentViewProvider value={view}><RootDocumentStack /></DocumentViewProvider>)
    expect(screen.queryByTestId('root-not-found')).toBeNull()
    expect(screen.getByTestId('book-leaf')).toBeTruthy()
  })

  it('preserves numeric editor denial beyond the hydration frame in the root stack', async () => {
    window.history.replaceState(null, '', '/travel/42')
    mockRootRoute.state!.routes = [{ key: 'editor', name: 'travel/[id]', params: { id: '42' } }]
    const screen = await render(<RootProbe pathname="/travel/42" />)
    expect(screen.getByTestId('root-not-found')).toBeTruthy()
    expect(screen.getByTestId('tabs-registration')).toBeTruthy()
    await screen.rerender(<RootProbe pathname="/travel/42" />)
    expect(screen.getByTestId('root-not-found')).toBeTruthy()
    await screen.rerender(<RootProbe pathname="/" />)
    await screen.rerender(<RootProbe pathname="/travel/42" />)
    expect(screen.queryByTestId('root-not-found')).toBeNull()
  })

  it.each(['android', 'ios'])('never applies a book document override or web root layout on %s', async platform => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: platform })
    window.history.replaceState(null, '', '/books/unknown')
    const frames: DocumentView[] = []
    const probe = await render(<Probe pathname="/books/unknown" onCommit={view => { frames.push(view) }} />)
    expect(frames).toEqual([{ kind: 'route', pathname: '/books/unknown' }])
    await probe.unmount()
    const view: DocumentView = { kind: 'not-found', pathname: '/books/unknown', bookHydrationPathname: '/books/unknown' }
    const screen = await render(<DocumentViewProvider value={view}><RootDocumentStack /></DocumentViewProvider>)
    expect(screen.queryByTestId('root-not-found')).toBeNull()
    expect(screen.getByTestId('book-leaf')).toBeTruthy()
  })
})
