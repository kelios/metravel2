import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Platform } from 'react-native'
import { parseQuestLocaleRoute } from '@/utils/questLocaleRouting'
import { shouldPrefetchTravelStatics } from '@/utils/staticPrefetchRoutes'
import { UNKNOWN_CITY_NOT_FOUND_ELEMENT_ID } from '@/utils/unknownCityNotFoundHydration'

export type DocumentView = {
  kind: 'route' | 'not-found'
  pathname: string
  deniedEditorPathname?: string
  bookHydrationPathname?: string
}

const DocumentViewContext = createContext<DocumentView | null>(null)
const DocumentRouteRegistrationContext = createContext(false)

export const DocumentRouteRegistrationProvider = DocumentRouteRegistrationContext.Provider

export function useDocumentRouteRegistration() {
  return useContext(DocumentRouteRegistrationContext)
}

export function DocumentViewProvider({ value, children }: { value: DocumentView; children: ReactNode }) {
  return <DocumentViewContext.Provider value={value}>{children}</DocumentViewContext.Provider>
}

export function useDocumentView() {
  return useContext(DocumentViewContext)
}

export function isNotFoundRoute(pathname: string, segments: readonly string[]) {
  return segments.some(segment => segment === '[...missing]' || segment === '+not-found')
    && !parseQuestLocaleRoute(pathname)
}

export function isNotFoundScreen(route: { name: string; params?: object }) {
  if (route.name !== '[...missing]' && route.name !== '+not-found') return false
  const missing = route.params && 'missing' in route.params ? route.params.missing : undefined
  const segments = typeof missing === 'string' ? [missing]
    : Array.isArray(missing) && missing.every(part => typeof part === 'string') ? missing : []
  return isNotFoundRoute(`/${segments.join('/')}`, [route.name])
}

type DocumentRoute = {
  name: string
  params?: object
  state?: { index?: number; routes: readonly DocumentRoute[] }
}

function focusedDocumentRoute(route: DocumentRoute | undefined) {
  if (!route) return undefined
  let focused = route
  while (focused.state) {
    const child = focused.state.routes[focused.state.index ?? 0]
    if (!child) return undefined
    focused = child
  }
  return focused
}

export function isDeniedEditorScreen(pathname: string | undefined, route: DocumentRoute | undefined) {
  const focused = focusedDocumentRoute(route)
  if (!pathname || !focused) return false
  return focused.name === 'travel/[id]' && focused.params !== undefined && 'id' in focused.params
    && typeof focused.params.id === 'string' && `/travel/${focused.params.id}` === pathname
}

function bookSlugFromDocumentPath(pathname: string) {
  const segment = /^\/books\/([^/]+)$/.exec(pathname)?.[1]
  if (!segment) return null
  try { return decodeURIComponent(segment) } catch { return null }
}

export function isBookHydrationScreen(pathname: string | undefined, route: DocumentRoute | undefined) {
  const focused = focusedDocumentRoute(route)
  if (!pathname || !focused) return false
  if (focused.name !== 'books/[slug]' || !focused.params || !('slug' in focused.params)
    || typeof focused.params.slug !== 'string') return false
  return bookSlugFromDocumentPath(pathname) === focused.params.slug
}

function readDeniedEditorDocument() {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') return null
  const pathname = window.location.pathname
  if (!/^\/travel\/[0-9]+$/.test(pathname)) return null
  return document.getElementById(UNKNOWN_CITY_NOT_FOUND_ELEMENT_ID) ? pathname : null
}

function readBookHydrationDocument() {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') return null
  const pathname = window.location.pathname
  if (bookSlugFromDocumentPath(pathname) === null) return null
  return document.getElementById(UNKNOWN_CITY_NOT_FOUND_ELEMENT_ID) ? pathname : null
}

/** The delivered document is a rendering hint, never an access decision. */
export function useRootDocumentView(pathname: string, segments: readonly string[]): DocumentView {
  const [deniedPathname] = useState(readDeniedEditorDocument)
  const [bookHydrationPathname, setBookHydrationPathname] = useState(readBookHydrationDocument)
  const consumed = useRef(false)
  useEffect(() => {
    if (deniedPathname && pathname !== deniedPathname) consumed.current = true
  }, [deniedPathname, pathname])
  // The static 404 owns the hydration frame. Afterwards the book route owns its
  // own unavailable-edition screen; unlike editor denial, this hint is one-shot.
  useEffect(() => { setBookHydrationPathname(null) }, [])

  const denied = deniedPathname !== null && !consumed.current && pathname === deniedPathname
  // Expo resolves route params into a decoded pathname; location retains URI
  // escaping. Keep the delivered URI for the leaf match, comparing both forms.
  const bookHydration = bookHydrationPathname !== null && (pathname === bookHydrationPathname
    || pathname === `/books/${bookSlugFromDocumentPath(bookHydrationPathname)}`)
  const kind = Platform.OS === 'web' && (denied || bookHydration || isNotFoundRoute(pathname, segments)) ? 'not-found' : 'route'
  return useMemo(() => ({
    kind, pathname,
    ...(denied ? { deniedEditorPathname: deniedPathname } : {}),
    ...(bookHydration ? { bookHydrationPathname } : {}),
  }), [kind, pathname, denied, deniedPathname, bookHydration, bookHydrationPathname])
}

export function getDocumentPresentation(view: DocumentView) {
  const p = view.pathname
  const notFound = view.kind === 'not-found'
  return {
    showFooter: notFound || !(
      p === '/login' || p === '/registration' || p === '/register' || p === '/messages'
      || /^\/travel\/[^/]+$/.test(p)
    ),
    prefetchTravelStatics: !notFound && shouldPrefetchTravelStatics(p),
    isTravelRoute: !notFound && /^\/travels\/[^/]+$/.test(p),
    isMapRoute: !notFound && (p === '/map' || p.startsWith('/map/')),
    hasMapBackground: !notFound && (p.includes('roulette') || p.includes('random')),
  }
}
