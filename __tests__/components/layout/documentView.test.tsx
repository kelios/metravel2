import React from 'react'
import { Platform, Text } from 'react-native'
import { act, render } from '@testing-library/react-native'
import { getDocumentPresentation, isDeniedEditorScreen, isNotFoundRoute, isNotFoundScreen, useRootDocumentView } from '@/components/layout/documentView'

function Probe({ pathname, segments = [] }: { pathname: string; segments?: string[] }) {
  const view = useRootDocumentView(pathname, segments)
  return <Text testID="view">{JSON.stringify({ ...view, ...getDocumentPresentation(view) })}</Text>
}

describe('delivered document ownership (#2701)', () => {
  const originalPlatform = Platform.OS
  let marker: HTMLDivElement
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    marker = document.createElement('div'); marker.id = 'static-not-found'; document.body.appendChild(marker)
  })
  afterEach(() => { marker.remove(); Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform }) })

  it.each(['/travel/42', '/travel/0', '/travel/000123', '/travel/9007199254740993'])('uses the delivered marker at numeric server route %s', pathname => {
    window.history.replaceState(null, '', pathname)
    const screen = render(<Probe pathname={pathname} />)
    expect(JSON.parse(screen.getByTestId('view').props.children)).toMatchObject({ kind: 'not-found', pathname, showFooter: true, prefetchTravelStatics: false })
  })

  it.each(['/travel/new', '/travel/slug', '/travel/-1', '/travel/42/extra', '/travels/42', '/search'])('does not redefine unrelated matched route %s', pathname => {
    window.history.replaceState(null, '', pathname)
    const screen = render(<Probe pathname={pathname} />)
    expect(JSON.parse(screen.getByTestId('view').props.children).kind).toBe('route')
  })

  it('does not read a marker inserted later by an SPA route', () => {
    window.history.replaceState(null, '', '/travel/42')
    marker.remove()
    const screen = render(<Probe pathname="/travel/42" />)
    document.body.appendChild(marker)
    screen.rerender(<Probe pathname="/travel/42" />)
    expect(JSON.parse(screen.getByTestId('view').props.children)).toMatchObject({ kind: 'route', showFooter: false, prefetchTravelStatics: true })
  })

  it('retains denial through rerenders and consumes it permanently after a committed departure', () => {
    window.history.replaceState(null, '', '/travel/42')
    const readMarker = jest.spyOn(document, 'getElementById')
    const screen = render(<Probe pathname="/travel/42" />)
    marker.remove()
    screen.rerender(<Probe pathname="/travel/42" />)
    expect(JSON.parse(screen.getByTestId('view').props.children).kind).toBe('not-found')
    act(() => screen.rerender(<Probe pathname="/" />))
    expect(JSON.parse(screen.getByTestId('view').props.children)).toMatchObject({ kind: 'route', pathname: '/' })
    screen.rerender(<Probe pathname="/travel/42" />)
    expect(JSON.parse(screen.getByTestId('view').props.children)).toMatchObject({ kind: 'route', pathname: '/travel/42', showFooter: false, prefetchTravelStatics: true })
    expect(readMarker).toHaveBeenCalledTimes(1)
    readMarker.mockRestore()
  })

  it.each(['android', 'ios'])('is inert on %s even with a web marker and matching route', platform => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: platform })
    window.history.replaceState(null, '', '/travel/42')
    const screen = render(<Probe pathname="/travel/42" segments={['+not-found']} />)
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
})
