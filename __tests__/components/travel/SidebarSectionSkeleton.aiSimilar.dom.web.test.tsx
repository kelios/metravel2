/**
 * #3430: the sidebar placeholder holds the place of «Похожие статьи». Without it
 * the sidebar reveal grew into the flow (949 → 2368 px on 390, Hexenstieg) and,
 * at the end of the article, that growth landed in the reader's scroll frame.
 * The block's card count follows its own narrow rule: 3 on a phone, 6 wide.
 */
let createElement: typeof import('react').createElement
let renderToStaticMarkup: typeof import('react-dom/server').renderToStaticMarkup
let Skeleton: React.ComponentType<{ travel: unknown }>
let mockSidebarWidth = 390
let mockSimilarEnabled = true

beforeAll(() => {
  jest.resetModules()
  // The build folds the literal flag; the runtime switch is `isAiSimilarEnabled`.
  process.env.EXPO_PUBLIC_AI_SIMILAR_SOURCE = 'static'
  jest.doMock('react-native', () => {
    const rnw = jest.requireActual('react-native-web')
    return new Proxy(rnw, {
      get: (target, key) =>
        key === 'useWindowDimensions'
          ? () => ({ width: mockSidebarWidth, height: 900, scale: 1, fontScale: 1 })
          : target[key],
    })
  })
  jest.doMock('@/hooks/useResponsive', () => ({ ...jest.requireActual('@/hooks/useResponsive'), useResponsiveWidth: () => mockSidebarWidth }))
  jest.doMock('@/utils/aiPicksConfig', () => ({ ...jest.requireActual('@/utils/aiPicksConfig'), isAiSimilarEnabled: () => mockSimilarEnabled }))
  jest.doMock('expo-router', () => ({ router: { push: jest.fn() } }))
  ;({ createElement } = require('react'))
  ;({ renderToStaticMarkup } = require('react-dom/server.node'))
  Skeleton = require('@/components/travel/NearTravelListSkeleton').SidebarSectionSkeleton
})

const render = (travel: { id?: number } = { id: 544 }) => {
  const host = document.createElement('div')
  host.innerHTML = renderToStaticMarkup(createElement(Skeleton, { travel }))
  return host
}

describe('SidebarSectionSkeleton keeps the «Похожие» place (#3430)', () => {
  it.each([[390, 3], [1280, 6]])('reserves the block with its own card count at %ipx', (width, cards) => {
    mockSidebarWidth = width
    mockSimilarEnabled = true
    const block = render().querySelector('[data-testid="travel-sidebar-similar-skeleton"]')
    expect(block).not.toBeNull()
    expect(block!.querySelectorAll('[data-testid="ai-pick-card-skeleton"]')).toHaveLength(cards)
  })

  it('reserves nothing while the block is switched off', () => {
    mockSidebarWidth = 390
    mockSimilarEnabled = false
    expect(render().querySelector('[data-testid="travel-sidebar-similar-skeleton"]')).toBeNull()
  })

  it('reserves nothing without a valid travel id: the section itself would not mount', () => {
    mockSidebarWidth = 390
    mockSimilarEnabled = true
    expect(render({}).querySelector('[data-testid="travel-sidebar-similar-skeleton"]')).toBeNull()
  })
})
