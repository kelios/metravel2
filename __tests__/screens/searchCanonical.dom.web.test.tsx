import type React from 'react'

/**
 * #3335 (P3 гейта #3323): клиентский canonical `/search` берёт `?page=N` только
 * пока на экране указатель этой страницы. На статике без SSR `/search?page=7` и
 * `/search?page=999999` сервер отдаёт `/search` (404 не бывает), и после JS
 * canonical не должен уводить на несуществующую страницу.
 */
let createElement: typeof import('react').createElement
let renderToStaticMarkup: typeof import('react-dom/server').renderToStaticMarkup
let SearchScreen: React.ComponentType
let PageContext: typeof import('@/components/listTravel/searchCatalogPageContext').SearchCatalogPageContext
const canonicals: string[] = []

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('expo-router', () => ({
    usePathname: () => '/search',
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
    useIsFocused: () => true,
  }))
  jest.doMock('@/components/seo/LazyInstantSEO', () => ({
    __esModule: true,
    default: ({ canonical }: { canonical: string }) => {
      canonicals.push(canonical)
      return null
    },
  }))
  jest.doMock('@/context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: false }) }))
  jest.doMock('@/hooks/useTheme', () => ({ useThemedColors: () => ({ background: '#fff', primaryDark: '#000' }) }))
  jest.doMock('@/hooks/useResponsive', () => ({ useResponsiveWidth: () => 0 }))
  jest.doMock('@/components/ui/ErrorBoundary', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => children }))
  jest.doMock('@/utils/aiAssistantConfig', () => ({ isAiAssistantEnabled: () => false }))
  jest.doMock('@/components/listTravel/SearchPageSkeleton', () => ({ __esModule: true, default: () => null }))
  jest.doMock('@/components/listTravel/SearchListTravelRoute', () => ({ __esModule: true, default: () => null }))
  ;({ createElement } = require('react'))
  ;({ renderToStaticMarkup } = require('react-dom/server.node'))
  SearchScreen = require('../../app/(tabs)/search').default
  ;({ SearchCatalogPageContext: PageContext } = require('@/components/listTravel/searchCatalogPageContext'))
})

beforeEach(() => {
  canonicals.length = 0
})

const canonicalWith = (visible: { page: number; footer: null; dismiss: () => void } | null) => {
  renderToStaticMarkup(createElement(PageContext.Provider, { value: visible }, createElement(SearchScreen)))
  return canonicals.at(-1)
}

it('keeps /search as canonical while no page pointer is on screen (static /search?page=7, ?page=999999)', () => {
  expect(canonicalWith(null)).toBe('https://metravel.by/search')
})

it('follows the visible catalogue page and gives page 1 the bare /search', () => {
  expect(canonicalWith({ page: 7, footer: null, dismiss: jest.fn() })).toBe('https://metravel.by/search?page=7')
  expect(canonicalWith({ page: 1, footer: null, dismiss: jest.fn() })).toBe('https://metravel.by/search')
})
