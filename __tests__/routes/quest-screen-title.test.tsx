/**
 * @jest-environment jsdom
 */

import React from 'react'
import { act } from 'react-test-renderer'
import { render } from '@testing-library/react-native'

const mockUseIsFocused = jest.fn(() => true)
const mockUseLocalSearchParams = jest.fn(() => ({ city: '4', questId: 'minsk-cmok' }))
const mockRouterPush = jest.fn()
const mockUseAuth = jest.fn(() => ({ isAuthenticated: true }))
const mockUseQuestBundle = jest.fn(() => ({
  bundle: {
    id: 77,
    title: 'Тайна Свислочского Цмока: Легенда оживает',
    storageKey: 'minsk-cmok',
    coverUrl: undefined as string | undefined,
    steps: [],
    finale: null,
    intro: null,
    city: { name: 'Минск', countryCode: 'BY', lat: 53.9, lng: 27.56 },
  },
  loading: false,
  error: null,
  refetch: jest.fn(),
}))
const mockUseQuestProgressSync = jest.fn(() => ({
  progress: null,
  progressLoading: false,
  saveProgress: jest.fn(),
  resetProgress: jest.fn(),
}))

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  Link: ({ children }: { children: React.ReactNode }) => children,
  useIsFocused: () => mockUseIsFocused(),
  useRouter: () => ({ push: mockRouterPush }),
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    background: '#fff',
    surface: '#fff',
    border: '#ddd',
    primary: '#f60',
    text: '#222',
    textMuted: '#666',
    textOnPrimary: '#fff',
  }),
}))

jest.mock('@/hooks/useQuestsApi', () => ({
  useQuestBundle: (...args: any[]) => mockUseQuestBundle(...args),
  useQuestProgressSync: (...args: any[]) => mockUseQuestProgressSync(...args),
  useQuestReviews: () => ({
    data: [],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  }),
}))

jest.mock('@/hooks/useQuestRatingMeta', () => ({
  useQuestRatingMeta: () => ({ ratingAvg: null, ratingCount: 0 }),
}))

jest.mock('@/hooks/useQuestCompletionMeta', () => ({
  useQuestCompletionMeta: () => ({ isCompletedByMe: false, completionsCount: 0 }),
}))

jest.mock('@/hooks/useQuestPioneerMeta', () => ({
  useQuestPioneerMeta: () => null,
}))

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

const mockQuestWizard = jest.fn(() => null)

jest.mock('@/components/quests/QuestWizard', () => ({
  QuestWizard: (props: any) => mockQuestWizard(props),
}))

const mockUseGuestQuestFlow = jest.fn(() => ({
  guestInitial: null,
  guestReady: true,
  guestFreeSteps: 2,
  persistGuestProgress: jest.fn(),
  goToLogin: jest.fn(),
  goToRegister: jest.fn(),
}))

jest.mock('@/components/quests/useGuestQuestFlow', () => ({
  useGuestQuestFlow: (...args: any[]) => mockUseGuestQuestFlow(...args),
}))

jest.mock('@/components/quests/TravelsForQuestSection', () => ({
  __esModule: true,
  default: () => null,
}))

const IMAGE_SELECTORS = [
  'meta[property="og:image"]',
  'meta[property="og:image:secure_url"]',
  'meta[name="twitter:image"]',
]

const appendImageHead = (image: string) => {
  for (const [attribute, value] of [
    ['property', 'og:image'],
    ['property', 'og:image:secure_url'],
    ['name', 'twitter:image'],
  ]) {
    const node = document.createElement('meta')
    node.setAttribute(attribute, value)
    node.setAttribute('content', image)
    document.head.appendChild(node)
  }
}

const expectSingleImageHead = (image: string) => {
  for (const selector of IMAGE_SELECTORS) {
    const nodes = document.head.querySelectorAll(selector)
    expect(nodes).toHaveLength(1)
    expect(nodes[0].getAttribute('content')).toBe(image)
  }
}

// Keep the real LazyInstantSEO and JSON-LD serializer; only Expo Head's renderer
// is mocked by the common setup. This checks declarative tags before any timers.
const expectRenderedImage = (screen: ReturnType<typeof render>, image: string) => {
  for (const key of ['og:image', 'og:image:secure_url', 'twitter:image']) {
    const nodes = screen.UNSAFE_root.findAll((node) =>
      node.type === 'meta' && (node.props.property === key || node.props.name === key),
    )
    expect(nodes).toHaveLength(1)
    expect(nodes[0].props.content).toBe(image)
  }
  const script = screen.UNSAFE_root.findByProps({ type: 'application/ld+json' })
  const jsonLd = JSON.parse(script.props.dangerouslySetInnerHTML.__html)
  expect(jsonLd['@graph']).toContainEqual(expect.objectContaining({
    '@type': 'CreativeWork',
    image: [image],
  }))
}

describe('Quest screen title sync', () => {
  beforeAll(() => {
    const RN = require('react-native')
    RN.Platform.OS = 'web'
    RN.Platform.select = (obj: Record<string, unknown>) => obj.web || obj.default
  })

  beforeEach(() => {
    jest.useFakeTimers()
    mockUseIsFocused.mockReturnValue(true)
    mockUseLocalSearchParams.mockReturnValue({ city: '4', questId: 'minsk-cmok' })
    mockRouterPush.mockClear()
    mockUseAuth.mockReturnValue({ isAuthenticated: true })
    mockUseQuestBundle.mockClear()
    mockUseQuestBundle.mockReturnValue({
      bundle: {
        id: 77,
        title: 'Тайна Свислочского Цмока: Легенда оживает',
        storageKey: 'minsk-cmok',
        coverUrl: undefined,
        steps: [],
        finale: null,
        intro: null,
        city: { name: 'Минск', countryCode: 'BY', lat: 53.9, lng: 27.56 },
      },
      loading: false,
      error: null,
      refetch: jest.fn(),
    })
    mockUseQuestProgressSync.mockClear()
    mockUseQuestProgressSync.mockReturnValue({
      progress: null,
      progressLoading: false,
      saveProgress: jest.fn(),
      resetProgress: jest.fn(),
    })
    mockQuestWizard.mockClear()
    mockUseGuestQuestFlow.mockClear()
    mockUseGuestQuestFlow.mockReturnValue({
      guestInitial: null,
      guestReady: true,
      guestFreeSteps: 2,
      persistGuestProgress: jest.fn(),
      goToLogin: jest.fn(),
      goToRegister: jest.fn(),
    })
    document.title = 'Energylandia - польский Диснейленд.'
    document.body.innerHTML = ''
    document.head.innerHTML = [
      '<meta name="description" content="old desc">',
      '<meta property="og:title" content="Energylandia - польский Диснейленд.">',
      '<meta property="og:description" content="old desc">',
      '<meta property="og:url" content="https://metravel.by/travels/energylandia-polskiy-disneylend">',
      '<meta property="og:type" content="article">',
      '<meta name="twitter:title" content="Energylandia - польский Диснейленд.">',
      '<meta name="twitter:description" content="old desc">',
      '<meta name="robots" content="noindex, nofollow">',
      '<link rel="canonical" href="https://metravel.by/travels/energylandia-polskiy-disneylend">',
    ].join('')
  })

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers()
    })
    jest.useRealTimers()
  })

  it('updates document title and canonical when quest screen becomes active', async () => {
    const QuestScreen = require('@/app/(tabs)/quests/[city]/[questId]').default

    render(<QuestScreen />)

    await act(async () => {
      jest.advanceTimersByTime(500)
      await Promise.resolve()
    })

    expect(document.title).toBe(
      'Минск — Тайна Свислочского Цмока: Легенда оживает | Metravel',
    )
    expect(
      document.querySelector('meta[property="og:title"]')?.getAttribute('content')
    ).toBe('Минск — Тайна Свислочского Цмока: Легенда оживает | Metravel')
    expect(
      document.querySelector('meta[name="description"]')?.getAttribute('content')
    ).toContain('Город Минск: бесплатный пеший маршрут')
    expect(
      document.querySelector('meta[property="og:description"]')?.getAttribute('content')
    ).toContain('по достопримечательностям')
    expect(
      document.querySelector('link[rel="canonical"]')?.getAttribute('href')
    ).toBe('https://metravel.by/quests/4/minsk-cmok')
    expect(document.querySelector('meta[name="robots"]')).toBeNull()
  })

  it.each([
    ['https://metravel.by/quest-cover/quests/77/main/cover.webp', 'https://metravel.by/quest-cover/quests/77/main/cover.webp?w=800'],
    ['/quest-cover/quests/77/main/cover.webp', 'https://metravel.by/quest-cover/quests/77/main/cover.webp?w=800'],
    ['//metravel.by/quest-cover/quests/77/main/cover.webp', 'https://metravel.by/quest-cover/quests/77/main/cover.webp?w=800'],
    ['  http://metravel.by/quest-cover/quests/77/main/cover.webp  ', 'https://metravel.by/quest-cover/quests/77/main/cover.webp?w=800'],
    ['https://metravel.by/quest-cover/quests/77/main/cover.webp?w=400', 'https://metravel.by/quest-cover/quests/77/main/cover.webp?w=400'],
    ['https://example.com/quest.jpg', 'https://example.com/quest.jpg'],
    [undefined, 'https://metravel.by/assets/icons/logo_yellow_512x512.png'],
    ['   ', 'https://metravel.by/assets/icons/logo_yellow_512x512.png'],
  ])('keeps one normalized cover in declarative SEO, JSON-LD and every delayed head write: %s', async (coverUrl, expected) => {
    const current = mockUseQuestBundle()
    mockUseQuestBundle.mockReturnValue({ ...current, bundle: { ...current.bundle, coverUrl } })
    const QuestScreen = require('@/app/(tabs)/quests/[city]/[questId]').default
    const screen = render(<QuestScreen />)

    expectRenderedImage(screen, expected)
    // SSG already carries the correct image. None of the route's later writes
    // may replace it with the original master URL (#1877).
    appendImageHead(expected)
    for (const elapsed of [0, 120, 280]) {
      // Expo can append another head set during reconciliation. The route must
      // still own all three image tags after each of its 0/120/400 ms patches.
      appendImageHead('https://metravel.by/quest-cover/previous.webp')
      await act(async () => {
        jest.advanceTimersByTime(elapsed)
        await Promise.resolve()
      })
      expectSingleImageHead(expected)
      expectRenderedImage(screen, expected)
    }
  })

  it('cancels stale image writes when the focused route changes to another quest', async () => {
    const current = mockUseQuestBundle()
    mockUseQuestBundle.mockReturnValue({
      ...current,
      bundle: { ...current.bundle, coverUrl: '/quest-cover/quests/77/main/cover.webp' },
    })
    const QuestScreen = require('@/app/(tabs)/quests/[city]/[questId]').default
    const screen = render(<QuestScreen />)
    await act(async () => {
      jest.advanceTimersByTime(100)
      await Promise.resolve()
    })

    mockUseLocalSearchParams.mockReturnValue({ city: '1', questId: 'krakow-dragon' })
    mockUseQuestBundle.mockReturnValue({
      ...current,
      bundle: {
        ...current.bundle,
        storageKey: 'krakow-dragon',
        coverUrl: '/quest-cover/quests/78/main/next.webp',
      },
    })
    screen.rerender(<QuestScreen />)
    const expected = 'https://metravel.by/quest-cover/quests/78/main/next.webp?w=800'
    expectRenderedImage(screen, expected)

    // Inspect both old and new deadlines: 100, 120, 220, 400 and 500 ms.
    for (const elapsed of [0, 20, 100, 180, 100]) {
      await act(async () => {
        jest.advanceTimersByTime(elapsed)
        await Promise.resolve()
      })
      expectSingleImageHead(expected)
      expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href'))
        .toBe('https://metravel.by/quests/1/krakow-dragon')
    }
  })

  it.each(['blur', 'unmount'])('leaves the destination image alone after quest %s', async (transition) => {
    const QuestScreen = require('@/app/(tabs)/quests/[city]/[questId]').default
    const screen = render(<QuestScreen />)
    await act(async () => {
      jest.advanceTimersByTime(100)
      await Promise.resolve()
    })
    if (transition === 'blur') {
      mockUseIsFocused.mockReturnValue(false)
      screen.rerender(<QuestScreen />)
    } else {
      screen.unmount()
    }

    IMAGE_SELECTORS.forEach((selector) => document.querySelectorAll(selector).forEach((node) => node.remove()))
    const destinationImage = 'https://metravel.by/og-map.png'
    appendImageHead(destinationImage)
    await act(async () => {
      jest.runOnlyPendingTimers()
      await Promise.resolve()
    })
    expectSingleImageHead(destinationImage)
  })

  it('does not load quest data or progress while the quest screen is not focused', () => {
    mockUseIsFocused.mockReturnValue(false)
    const QuestScreen = require('@/app/(tabs)/quests/[city]/[questId]').default

    render(<QuestScreen />)

    expect(mockUseQuestBundle).toHaveBeenCalledWith(undefined)
    expect(mockUseQuestProgressSync).toHaveBeenCalledWith(undefined, false)
  })

  it('renders the quest wizard in guest mode for logged-out users without loading server progress', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false })
    mockUseQuestBundle.mockReturnValue({
      bundle: {
        id: 77,
        title: 'Тайна Свислочского Цмока: Легенда оживает',
        storageKey: 'minsk-cmok',
        coverUrl: undefined,
        steps: [
          {
            id: 'step-1',
            title: 'Площадь у реки',
            location: 'Набережная Свислочи',
            story: 'Цмок оставил первый след у воды.',
            task: 'Найдите знак на ограде.',
            lat: 53.9,
            lng: 27.56,
            answer: jest.fn(),
          },
        ],
        finale: null,
        intro: { story: 'Начало легенды', lat: 53.9, lng: 27.56 },
        city: { name: 'Минск', countryCode: 'BY', lat: 53.9, lng: 27.56 },
      },
      loading: false,
      error: null,
      refetch: jest.fn(),
    })
    const QuestScreen = require('@/app/(tabs)/quests/[city]/[questId]').default

    render(<QuestScreen />)

    await act(async () => {
      jest.advanceTimersByTime(500)
      await Promise.resolve()
    })

    // Гость не грузит серверный прогресс (второй аргумент false).
    expect(mockUseQuestProgressSync).toHaveBeenCalledWith('minsk-cmok', false)
    // Визард смонтирован в гостевом режиме, а не login-wall preview.
    expect(mockQuestWizard).toHaveBeenCalled()
    const wizardProps = mockQuestWizard.mock.calls[0][0] as any
    expect(wizardProps.guestMode).toBe(true)
    expect(wizardProps.storageKey).toBe('guest_minsk-cmok')
    expect(typeof wizardProps.onGuestLogin).toBe('function')
    expect(typeof wizardProps.onGuestRegister).toBe('function')
    expect(document.title).toBe(
      'Минск — Тайна Свислочского Цмока: Легенда оживает | Metravel',
    )
    expect(document.querySelector('meta[name="robots"]')).toBeNull()
  })

  it('removes the no-JS SSG heading and leaves the H1 to the wizard', () => {
    // H1 страницы — это видимый заголовок самого визарда (`questWizardShell`:
    // RNW рендерит role=heading + aria-level настоящим тегом). Роут своего
    // заголовка не рисует: отдельный видимый блок дублировал заголовок панели и
    // лежал во всю ширину страницы мимо контейнера визарда.
    document.body.innerHTML = [
      '<section data-ssg-quest-intro="true"><h1>Static quest title</h1></section>',
      '<h1 data-ssg-travel-h1="true" style="position:absolute;width:1px;height:1px">Hidden fallback</h1>',
    ].join('')
    document.head.insertAdjacentHTML(
      'beforeend',
      '<style data-ssg-quest-intro-style="true">[data-ssg-quest-intro]{display:none}</style>',
    )
    const QuestScreen = require('@/app/(tabs)/quests/[city]/[questId]').default

    const { UNSAFE_root } = render(<QuestScreen />)

    expect(UNSAFE_root.findAll((node) => node.type === 'h1')).toHaveLength(0)
    expect(document.querySelector('section[data-ssg-quest-intro="true"]')).toBeNull()
    expect(document.querySelector('h1[data-ssg-travel-h1="true"]')).toBeNull()
    expect(document.querySelector('style[data-ssg-quest-intro-style="true"]')).toBeNull()
  })
})
