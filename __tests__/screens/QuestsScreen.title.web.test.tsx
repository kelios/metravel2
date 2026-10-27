import { render, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'

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
jest.mock('expo-router/head', () => {
  const React = require('react') as typeof import('react')

  function MockHead({ children }: { children?: import('react').ReactNode }) {
    React.useEffect(() => {
      const title = React.Children.toArray(children).find(
        (child) => React.isValidElement(child) && child.type === 'title',
      )

      if (React.isValidElement<{ children?: import('react').ReactNode }>(title)) {
        globalThis.document.title = React.Children.toArray(title.props.children).join('')
      }
    }, [children])

    return React.createElement(React.Fragment, null, children ?? null)
  }

  return {
    __esModule: true,
    default: MockHead,
  }
})
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

describe('QuestsScreen default catalog head (#1618)', () => {
  beforeEach(() => {
    document.title = ''
  })

  it('sets document.title to the canonical SSG-matching catalog title', async () => {
    const QuestsScreen = loadQuestsScreen()
    render(<QuestsScreen />)

    await waitFor(() => {
      expect(document.title).toBe('Городские квесты и маршруты с заданиями | Metravel')
    })
  })

  it('does not add a hidden raw <h1> beside the visible content-panel heading', () => {
    const QuestsScreen = loadQuestsScreen()
    const { UNSAFE_root } = render(<QuestsScreen />)

    expect(UNSAFE_root.findAll((node) => node.type === 'h1')).toHaveLength(0)
  })
})

describe('QuestsScreen catalog JSON-LD placement (#2817)', () => {
  type Node = ReturnType<typeof render>['UNSAFE_root']
  const scriptsIn = (root: Node) => root.findAll((node) => node.type === 'script')
  const headNodes = (root: Node) =>
    root.findAll((node) => typeof node.type === 'function' && node.type.name === 'MockHead')

  it('keeps the JSON-LD in Head for the client-only catalog', async () => {
    const QuestsScreen = loadQuestsScreen()
    const { UNSAFE_root } = render(<QuestsScreen />)
    await waitFor(() => expect(headNodes(UNSAFE_root)).toHaveLength(1))
    expect(scriptsIn(headNodes(UNSAFE_root)[0])).toHaveLength(2)
    expect(scriptsIn(UNSAFE_root)).toHaveLength(2)
  })

  it('moves the JSON-LD into the body, once, when the SSR loader seeded the catalog', async () => {
    const QuestsScreen = loadQuestsScreen()
    const { QuestDiscoveryContext } = require('@/components/quests/runtime/QuestDiscoveryContext')
    const { UNSAFE_root } = render(
      <QuestDiscoveryContext.Provider value={{ view: 'catalog', locale: 'ru', quests: [] }}>
        <QuestsScreen />
      </QuestDiscoveryContext.Provider>,
    )
    await waitFor(() => expect(document.title).toBe('Городские квесты и маршруты с заданиями | Metravel'))
    // Head is not mounted at all: its tags never reach the server HTML.
    expect(headNodes(UNSAFE_root)).toHaveLength(0)
    expect(scriptsIn(UNSAFE_root)).toHaveLength(2)
  })
})
