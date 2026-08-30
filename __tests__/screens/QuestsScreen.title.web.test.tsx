import { render, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'

// #1618: the unfiltered `/quests` catalog's runtime title (document.title,
// og:title, and the suffix-stripped sr-only <h1>) must match
// scripts/generate-seo-pages.js's static `/quests` <title> byte-for-byte —
// otherwise raw HTML (pre-hydration) and the hydrated head permanently
// disagree for the bare route. Heavy children (map, content panel, sidebar)
// are stubbed out: this test only cares about QuestsScreen's own head/H1
// output, not the catalog list UI.
jest.mock('expo-router', () => ({
  useIsFocused: () => true,
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

  it('keeps the sr-only <h1> text in sync with the title, suffix stripped', () => {
    const QuestsScreen = loadQuestsScreen()
    const { UNSAFE_root } = render(<QuestsScreen />)

    const h1 = UNSAFE_root.findByType('h1' as never)
    expect(h1.props.children).toBe('Городские квесты и маршруты с заданиями')
  })
})
