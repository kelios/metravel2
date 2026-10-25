/** @jest-environment jsdom */
import type React from 'react'

let createElement: typeof import('react').createElement
let act: typeof import('react').act
let useLayoutEffect: typeof import('react').useLayoutEffect
let hydrateRoot: typeof import('react-dom/client').hydrateRoot
let renderToString: typeof import('react-dom/server').renderToString
let Screen: React.ComponentType
let mockPath = '/travel/new'
let mockParams: { previewTravel?: string | string[] } = {}
let mockAuthReady = false
let mockCommitted = false
const mockRouter = { replace: jest.fn() }
const mockEditorMount = jest.fn()

jest.mock('expo-router', () => ({
  usePreventRemove: () => jest.fn(),
  useRouter: () => mockRouter,
  usePathname: () => mockPath,
  useLocalSearchParams: () => mockParams,
}))
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (select: (state: { authReady: boolean }) => unknown) => select({ authReady: mockAuthReady }),
}))
jest.mock('@/components/travel/upsert/UpsertTravelRoute', () => ({
  __esModule: true,
  default: () => {
    mockEditorMount()
    return require('react').createElement('div', { 'data-testid': 'editor' }, 'editor')
  },
}))

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  ;({ createElement, act, useLayoutEffect } = require('react'))
  ;({ hydrateRoot } = require('react-dom/client'))
  ;({ renderToString } = require('react-dom/server.node'))
  Screen = require('@/components/travel/upsert/LazyUpsertTravelRoute.web').default
})

beforeEach(() => {
  jest.useFakeTimers()
  mockPath = '/travel/new'
  mockParams = {}
  mockAuthReady = false
  mockCommitted = false
  mockRouter.replace.mockReset()
  mockEditorMount.mockClear()
})
afterEach(() => jest.useRealTimers())

function HydrationFrame() {
  useLayoutEffect(() => { mockCommitted = true }, [])
  return createElement(Screen)
}

async function hydrate(params: typeof mockParams, pathname = '/travel/new', authReady = false) {
  const html = renderToString(createElement(HydrationFrame))
  expect(mockRouter.replace).not.toHaveBeenCalled()
  const container = document.createElement('div')
  container.innerHTML = html
  document.body.appendChild(container)
  mockParams = params
  mockPath = pathname
  mockAuthReady = authReady
  const errors: unknown[] = []
  let root: ReturnType<typeof hydrateRoot>
  await act(async () => {
    root = hydrateRoot(container, createElement(HydrationFrame), { onRecoverableError: (error) => errors.push(error) })
  })
  return {
    container, errors,
    rerender: async () => { await act(async () => { root.render(createElement(HydrationFrame)); jest.advanceTimersByTime(120) }) },
    cleanup: async () => { await act(async () => root.unmount()); container.remove() },
  }
}

describe('cold author preview lifecycle (#2695)', () => {
  it.each([{ previewTravel: '42' }, { previewTravel: ['42', '99'] }])('keeps SSR parity, waits for session, and never mounts the editor: %p', async ({ previewTravel }) => {
    const view = await hydrate({ previewTravel })
    try {
      expect(view.errors).toEqual([])
      expect(view.container.querySelector('[role="progressbar"]')).not.toBeNull()
      expect(mockRouter.replace).not.toHaveBeenCalled()
      await view.rerender()
      expect(mockEditorMount).not.toHaveBeenCalled()
      expect(mockRouter.replace).not.toHaveBeenCalled()
      mockAuthReady = true
      await view.rerender()
      expect(mockRouter.replace).toHaveBeenCalledTimes(1)
      expect(mockRouter.replace).toHaveBeenCalledWith('/travels/42')
      expect(mockEditorMount).not.toHaveBeenCalled()
    } finally { await view.cleanup() }
  })

  it('navigates only after the server tree has committed even when auth is ready', async () => {
    mockRouter.replace.mockImplementation(() => {
      expect(mockCommitted).toBe(true)
      expect(document.querySelector('[role="progressbar"]')).not.toBeNull()
    })
    const view = await hydrate({ previewTravel: '7100' }, '/travel/new', true)
    try {
      expect(view.errors).toEqual([])
      expect(mockRouter.replace).toHaveBeenCalledWith('/travels/7100')
      expect(mockEditorMount).not.toHaveBeenCalled()
    } finally { await view.cleanup() }
  })

  it.each([undefined, '', '0', '-1', 'slug', '1/2', 'https://example.com', []].map((previewTravel) => ({ previewTravel })))(
    'invalid/no preview keeps the normal create lifecycle: %p', async ({ previewTravel }) => {
      const view = await hydrate({ previewTravel })
      try {
        await view.rerender()
        expect(view.errors).toEqual([])
        expect(mockRouter.replace).not.toHaveBeenCalled()
        expect(view.container.querySelector('[data-testid="editor"]')).not.toBeNull()
      } finally { await view.cleanup() }
    },
  )

  it('does not activate the bridge on an edit route', async () => {
    const view = await hydrate({ previewTravel: '42' }, '/travel/42', true)
    try {
      await view.rerender()
      expect(view.errors).toEqual([])
      expect(mockRouter.replace).not.toHaveBeenCalled()
      expect(view.container.querySelector('[data-testid="editor"]')).not.toBeNull()
    } finally { await view.cleanup() }
  })
})
