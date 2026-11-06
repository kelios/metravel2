/**
 * @jest-environment jsdom
 */

import type React from 'react'
import type { Root } from 'react-dom/client'

let act: typeof import('react').act
let createElement: typeof import('react').createElement
let waitFor: typeof import('@testing-library/dom').waitFor
let within: typeof import('@testing-library/dom').within
let hydrateRoot: typeof import('react-dom/client').hydrateRoot
let renderToString: typeof import('react-dom/server').renderToString
let QueryClient: typeof import('@tanstack/react-query').QueryClient
let QueryClientProvider: typeof import('@tanstack/react-query').QueryClientProvider
let Screen: React.ComponentType
let mockParams: Record<string, string> = {}
const mockFetchRequest = jest.fn()
const mockFetchRequests = jest.fn()
const requestId = '00000000-0000-4000-8000-000000000000'

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ replace: jest.fn(), setParams: jest.fn() }),
}))
jest.mock('@expo/vector-icons/Feather', () => () => null)
jest.mock('@/components/seo/LazyInstantSEO', () => () => null)
jest.mock('@/i18n/LocaleProvider', () => ({
  ...jest.requireActual('@/i18n/LocaleProvider'),
  useLocale: () => ({ locale: 'ru' }),
}))
jest.mock('@/api/placeRequests', () => ({
  fetchPlaceRequest: mockFetchRequest,
  fetchPlaceRequests: mockFetchRequests,
}))

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  ;({ act, createElement } = require('react'))
  ;({ waitFor, within } = require('@testing-library/dom'))
  ;({ hydrateRoot } = require('react-dom/client'))
  ;({ renderToString } = require('react-dom/server.node'))
  ;({ QueryClient, QueryClientProvider } = require('@tanstack/react-query'))
  Screen = require('@/components/places/PlaceRequestsScreen').default
})

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
  return createElement(QueryClientProvider, { client }, createElement(Screen))
}

beforeEach(() => {
  jest.clearAllMocks()
  mockParams = {}
  const { ApiError } = require('@/api/client')
  mockFetchRequest.mockRejectedValue(new ApiError(404, 'Not found'))
  mockFetchRequests.mockResolvedValue([])
})

it('hydrates the static collection for a cold detail link and fetches only that request', async () => {
  const container = document.createElement('div')
  container.innerHTML = renderToString(renderScreen())
  document.body.appendChild(container)
  const view = within(container)
  expect(view.getByText('Все области')).toBeTruthy()
  expect(view.queryByText('К подборке мест')).toBeNull()
  expect(mockFetchRequests).not.toHaveBeenCalled()
  expect(mockFetchRequest).not.toHaveBeenCalled()

  mockParams = { request: requestId }
  const errors: unknown[] = []
  let root: Root | undefined
  try {
    await act(async () => {
      root = hydrateRoot(container, renderScreen(), {
        onRecoverableError: (error) => errors.push(error),
      })
    })
    expect(errors).toEqual([])
    await waitFor(() => expect(view.getByText('Приглашение сейчас недоступно')).toBeTruthy())
    expect(view.getByText('К подборке мест')).toBeTruthy()
    expect(view.queryByText('Все области')).toBeNull()
    expect(mockFetchRequest).toHaveBeenCalledTimes(1)
    expect(mockFetchRequest).toHaveBeenCalledWith(requestId, 'ru', expect.any(AbortSignal))
    expect(mockFetchRequests).not.toHaveBeenCalled()
  } finally {
    await act(async () => { root?.unmount() })
    container.remove()
  }
})
