import { act } from 'react'
import { render, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'
import { createRoot, type Root } from 'test-renderer'
import { HelmetProvider } from 'expo-router/vendor/react-helmet-async/lib'
import { activeHelmetHeads, readHelmetHead } from '../helpers/helmetHead'

// #1618: the unfiltered `/quests` catalog's runtime title (document.title,
// and og:title) must match the static `/quests` <title> from
// utils/seoRoutes/staticRoutes.js (the route head and
// scripts/postprocess-route-shells.js both read it) byte-for-byte —
// otherwise raw HTML (pre-hydration) and the hydrated head permanently
// disagree for the bare route. The visible H1 is owned by QuestsContentPanel;
// QuestsScreen must not add a second hidden raw heading beside it. Heavy
// children (map, content panel, sidebar) are stubbed out here.
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}), useIsFocused: () => true,
}))
jest.mock('expo-router/head', () => require('../helpers/helmetHead').createHelmetHeadMock())
jest.mock('@/components/MapPage/Map.web', () => () => null)
jest.mock('@/screens/tabs/QuestsContentPanel', () => () => null)
jest.mock('@/screens/tabs/QuestsSidebar', () => () => null)
const STABLE_EMPTY_QUESTS: unknown[] = []
jest.mock('@/hooks/useQuestsApi', () => ({
  // A fresh [] every render (as a naive mock would return) keeps re-triggering
  // QuestsScreen's `citiesByCountry` useMemo/effect chain forever (real
  // React Query memoizes `data` and only changes reference when data actually
  // changes) — reuse one stable array so this test mirrors that contract.
  useQuestsList: () => ({ quests: STABLE_EMPTY_QUESTS, loading: false, error: null }),
}))

function loadQuestsScreen() {
  (Platform as { OS: string }).OS = 'web'
  return require('@/screens/tabs/QuestsScreen').default
}

const originalOS = Platform.OS
const originalCanUseDOM = HelmetProvider.canUseDOM
let bodyRoot: Root | undefined

beforeAll(() => { HelmetProvider.canUseDOM = false })
afterAll(() => {
  HelmetProvider.canUseDOM = originalCanUseDOM
  ;(Platform as { OS: string }).OS = originalOS
})
afterEach(async () => {
  await act(() => bodyRoot?.unmount())
  bodyRoot = undefined
})

describe('QuestsScreen default catalog head (#1618)', () => {
  beforeEach(() => {
    document.title = ''
  })

  it('sets document.title to the canonical SSG-matching catalog title', async () => {
    const QuestsScreen = loadQuestsScreen()
    await render(<QuestsScreen />)

    await waitFor(() => {
      expect(document.title).toBe('Городские квесты и маршруты с заданиями | Metravel')
    })
  })

  it('does not add a hidden raw <h1> beside the visible content-panel heading', async () => {
    const QuestsScreen = loadQuestsScreen()
    const { container } = await render(<QuestsScreen />)

    expect(container.queryAll((node) => node.type === 'h1')).toHaveLength(0)
  })
})

describe('QuestsScreen catalog JSON-LD placement (#2817)', () => {
  it('keeps the JSON-LD in Head for the client-only catalog', async () => {
    const QuestsScreen = loadQuestsScreen()
    const { container } = await render(<QuestsScreen />)
    await waitFor(() => expect(activeHelmetHeads.size).toBe(1))
    const { scripts } = readHelmetHead()
    expect(scripts).toHaveLength(2)
    expect(scripts.every((script) => script.type === 'application/ld+json')).toBe(true)
    // Head consumes these scripts through Helmet; there must be no body copies.
    expect(container.queryAll((node) => node.type === 'script')).toHaveLength(0)
  })

  it('moves the JSON-LD into the body, once, when the SSR loader seeded the catalog', async () => {
    const QuestsScreen = loadQuestsScreen()
    const { QuestDiscoveryContext } = require('@/components/quests/runtime/QuestDiscoveryContext')
    // SSR-seeded web output deliberately contains raw HTML script text in the
    // body. Use the public generic renderer for this web-only subtree rather
    // than relaxing native text validation in RNTL.
    bodyRoot = createRoot()
    await act(() => {
      bodyRoot!.render(
        <QuestDiscoveryContext.Provider value={{ view: 'catalog', locale: 'ru', quests: [] }}>
          <QuestsScreen />
        </QuestDiscoveryContext.Provider>,
      )
    })
    await waitFor(() => expect(document.title).toBe('Городские квесты и маршруты с заданиями | Metravel'))
    // Head is not mounted at all: its tags never reach the server HTML.
    expect(activeHelmetHeads.size).toBe(0)
    const bodyScripts = bodyRoot.container.queryAll((node) => node.type === 'script')
    expect(bodyScripts).toHaveLength(2)
    expect(bodyScripts.every((script) => script.props.type === 'application/ld+json')).toBe(true)
  })
})
