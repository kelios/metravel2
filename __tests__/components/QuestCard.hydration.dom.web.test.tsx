import type React from 'react'
import '@testing-library/jest-dom'

function setup(width: number) {
  jest.resetModules()
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 })
  window.dispatchEvent(new Event('resize'))
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  const react: typeof import('react') = require('react')
  const empty = () => null
  jest.doMock('expo-router', () => ({ router: { push: jest.fn() } }))
  jest.doMock('@expo/vector-icons/Feather', () => ({ __esModule: true, default: empty }))
  jest.doMock('@/components/layout/NavigationIcon', () => ({ __esModule: true, default: empty }))
  jest.doMock('@/components/layout/UserAvatar', () => ({ __esModule: true, default: empty }))
  jest.doMock('@/components/quests/QuestReviewsModal', () => ({ __esModule: true, default: empty }))
  jest.doMock('@/components/ui/ShimmerOverlay', () => ({ ShimmerOverlay: empty }))
  jest.doMock('@/components/ui/ImageCardMedia', () => ({
    __esModule: true,
    default: ({ height }: { height: number }) => react.createElement('div', {
      'data-testid': 'quest-media-probe', 'data-height': String(height),
    }),
  }))
  jest.doMock('@/hooks/useQuestContentLocale', () => ({ useQuestContentLocale: () => 'ru' }))
  const colors = {
    backgroundTertiary: '#ddd', backgroundSecondary: '#eee', borderLight: '#ccc',
    brandAlpha30: '#ddd', brandDark: '#123', primary: '#369', surface: '#fff',
    text: '#111', textMuted: '#666', textOnDark: '#fff',
  }
  jest.doMock('@/hooks/useTheme', () => ({
    useTheme: () => ({ activeSeasonalTheme: null }), useThemedColors: () => colors,
  }))
  const Card: React.ComponentType<any> = require('@/screens/tabs/QuestCard').default
  const { useHydrationReady } = require('@/hooks/useHydrationReady') as typeof import('@/hooks/useHydrationReady')
  const { useBreakpoints } = require('@/hooks/useResponsive') as typeof import('@/hooks/useResponsive')
  const { createRoot, hydrateRoot } = require('react-dom/client') as typeof import('react-dom/client')
  const { renderToString } = require('react-dom/server.node') as typeof import('react-dom/server')
  return { react, Card, useHydrationReady, useBreakpoints, createRoot, hydrateRoot, renderToString }
}

const quest = {
  id: 'hydration-card', cityId: 'minsk', cityName: 'Минск', title: 'Квест первого кадра',
  points: 6, durationMin: 90, difficulty: 'easy', cover: 'https://example.test/quest.webp',
  ratingAvg: 4.5, ratingCount: 3, completionsCount: 2, isCompletedByMe: false,
  firstCompleter: null,
}
const styles = new Proxy({}, { get: () => ({}) })
const read = (host: HTMLElement) => ({
  imageHeight: Number(host.querySelector('[data-testid="quest-media-probe"]')?.getAttribute('data-height')),
  reviewsInOverlay: host.querySelector('[data-testid="quest-card-reviews-hydration-card"]')?.getAttribute('data-card-action') === 'true',
  completions: host.querySelector('[data-testid="quest-card-completions-hydration-card"]')?.textContent,
})

it.each([
  [320, 288, 197, false],
  [390, 358, 238, true],
  [480, 448, 307, false],
  [1280, 380, 260, false],
] as const)('commits the final catalog card layout immediately at %spx', async (width, cardWidth, imageHeight, phone) => {
  const { react, Card, useHydrationReady, useBreakpoints, createRoot } = setup(width)
  const commits: ReturnType<typeof read>[] = []
  function Probe() {
    const ref = react.useRef<HTMLElement>(null)
    react.useLayoutEffect(() => { if (ref.current) commits.push(read(ref.current)) }, [])
    return react.createElement('section', { ref }, react.createElement(Card, {
      styles, cardWidth, cityId: 'minsk', quest, clientOnly: true,
    }))
  }
  function Catalog({ loaded }: { loaded: boolean }) {
    const hydrated = useHydrationReady()
    useBreakpoints({ clientOnly: true })
    return hydrated && loaded ? react.createElement(Probe) : react.createElement('span', null, 'Loading')
  }
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  try {
    await react.act(async () => { root.render(react.createElement(Catalog, { loaded: false })) })
    expect(commits).toEqual([])
    await react.act(async () => { root.render(react.createElement(Catalog, { loaded: true })) })
    expect(commits).toHaveLength(1)
    expect(commits[0].imageHeight).toBe(imageHeight)
    expect(commits[0].reviewsInOverlay).toBe(!phone)
    if (phone) expect(commits[0].completions).toBe('2')
    else expect(commits[0].completions).not.toBe('2')
    expect(read(container)).toEqual(commits[0])
  } finally {
    await react.act(async () => { root.unmount() })
    container.remove()
  }
})

it('preserves the server snapshot for a card without the post-hydration catalog opt-in', async () => {
  const { react, Card, hydrateRoot, renderToString } = setup(390)
  const commits: ReturnType<typeof read>[] = []
  function Probe() {
    const ref = react.useRef<HTMLElement>(null)
    react.useLayoutEffect(() => { if (ref.current) commits.push(read(ref.current)) }, [])
    return react.createElement('section', { ref }, react.createElement(Card, {
      styles, cardWidth: 358, cityId: 'minsk', quest,
    }))
  }
  const container = document.createElement('div')
  container.innerHTML = renderToString(react.createElement(Probe))
  document.body.appendChild(container)
  const server = read(container)
  const errors: unknown[] = []
  let root: ReturnType<typeof hydrateRoot> | undefined
  try {
    await react.act(async () => {
      root = hydrateRoot(container, react.createElement(Probe), { onRecoverableError: e => errors.push(e) })
    })
    expect(errors).toEqual([])
    expect(commits[0]).toEqual(server)
    expect(server.imageHeight).toBe(245)
    expect(server.reviewsInOverlay).toBe(true)
    expect(read(container).imageHeight).toBe(238)
  } finally {
    await react.act(async () => { root?.unmount() })
    container.remove()
  }
})
