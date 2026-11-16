/**
 * @jest-environment jsdom
 */

import React from 'react'
import { Platform } from 'react-native'
import { render } from '@testing-library/react-native'
import { HelmetProvider } from 'expo-router/vendor/react-helmet-async/lib'
import { resetHeadManagerForTests } from '@/utils/webHeadManager'

const mockUseIsFocused = jest.fn(() => true)
const mockReplace = jest.fn()
let mockCountryParam = 'belarus'
let mockLocale = 'ru'
let mockUseRealSeo = false
const mockCountryQuests = [
  { id: 'minsk-center', cityId: '4', cityName: 'Минск', countryCode: 'BY', countryName: 'Беларусь', title: 'Минский центр' },
]
let mockQuests = mockCountryQuests

jest.mock('expo-router', () => ({
  Link: ({ children }: { children?: React.ReactNode }) => children ?? null,
  // #2896: неизвестная страна рисует QuestNotFoundScreen со своим заголовком стека.
  Stack: { Screen: () => null },
  useIsFocused: () => mockUseIsFocused(),
  useLocalSearchParams: () => ({ country: mockCountryParam }),
  useNavigation: () => ({ setOptions: jest.fn() }),
  useRouter: () => ({ replace: mockReplace }),
}))

jest.mock('@expo/vector-icons/Feather', () => () => null)

// #2896: сам экран «не найдено» покрыт `__tests__/components/quests/QuestNotFoundScreen.test.tsx`;
// здесь проверяется только ветка маршрута (экран вместо редиректа). Лёгкая заглушка
// вместо ленивого дерева с сеткой популярных — холодная компиляция того дерева
// не укладывалась в таймаут теста.
jest.mock('@/components/quests/QuestNotFoundScreen', () => {
  const { View } = require('react-native')
  return { __esModule: true, default: () => <View testID="quest-not-found" /> }
})
jest.mock('expo-router/head', () => {
  const { Helmet, HelmetProvider } = require('expo-router/vendor/react-helmet-async/lib')
  return { __esModule: true, default: ({ children }: { children?: React.ReactNode }) => (
    <HelmetProvider><Helmet defer={false}>{children}</Helmet></HelmetProvider>
  ) }
})
jest.mock('@/components/seo/LazyInstantSEO', () => {
  const Actual = jest.requireActual('@/components/seo/LazyInstantSEO').default
  return { __esModule: true, default: (props: React.ComponentProps<typeof Actual>) => mockUseRealSeo ? <Actual {...props} /> : null }
})
jest.mock('@/components/quests/QuestCountryLandingSections', () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock('@/screens/tabs/QuestCard', () => ({ __esModule: true, default: () => null }))
jest.mock('@/screens/tabs/questsShared', () => ({
  pluralizeQuest: (count: number) => `${count} quest`,
}))
jest.mock('@/screens/tabs/QuestsScreen.styles', () => ({
  getStyles: () => ({ root: {}, questsGrid: {} }),
}))
jest.mock('@/hooks/useQuestsApi', () => {
  return {
    // Keep the catalog reference stable so this regression really proves that
    // the route's SEO effect responds to focus, not to an incidental rerender.
    useQuestsList: () => ({ loading: false, quests: mockQuests }),
  }
})
jest.mock('@/hooks/useQuestReturnVisit', () => ({ useQuestReturnVisit: () => undefined }))
jest.mock('@/hooks/useQuestCatalogResponsiveModel', () => ({
  ...jest.requireActual('@/hooks/useQuestCatalogResponsiveModel'),
  useQuestCatalogResponsiveModel: () => ({ cardWidth: 404, cardColumns: 2 }),
}))
jest.mock('@/hooks/useResponsive', () => ({
  useBreakpoints: () => ({ width: 1280, isMobile: false }),
}))
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ activeSeasonalTheme: null }),
  useThemedColors: () => jest.requireActual('@/constants/designSystem').getThemedColors(false),
}))
jest.mock('@/i18n/LocaleProvider', () => {
  const t = (key: string) => {
    if (key.endsWith('.metaDescription')) return 'Country description'
    if (key.endsWith('.seoTitle')) return 'Country title'
    return key
  }
  return {
    useLocale: () => ({ locale: mockLocale }),
    useTranslation: () => ({ t }),
  }
})

import QuestsByCountryScreen from '@/app/(tabs)/quests/country/[country]/index'

const GENERIC_DESCRIPTION = 'Generic description'
const COUNTRY_DESCRIPTION = 'Country description'
const GENERIC_OG_URL = 'https://metravel.by/quests'
const COUNTRY_OG_URL = 'https://metravel.by/quests/country/belarus'
const DESCRIPTION_SELECTORS = [
  'meta[name="description"]',
  'meta[property="og:description"]',
  'meta[name="twitter:description"]',
]

const expectSingleOgUrl = (content: string) => {
  const nodes = document.querySelectorAll('meta[property="og:url"]')
  expect(nodes).toHaveLength(1)
  expect(nodes[0].getAttribute('content')).toBe(content)
}

const expectSingleDescriptionSet = (content: string) => {
  for (const selector of DESCRIPTION_SELECTORS) {
    const nodes = document.querySelectorAll(selector)
    expect(nodes).toHaveLength(1)
    expect(nodes[0].getAttribute('content')).toBe(content)
  }
}

describe('quest country SEO focus lifecycle', () => {
  const originalPlatform = Platform.OS
  const originalCanUseDOM = HelmetProvider.canUseDOM

  beforeAll(() => {
    HelmetProvider.canUseDOM = true
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
  })

  afterAll(() => {
    HelmetProvider.canUseDOM = originalCanUseDOM
    Object.defineProperty(Platform, 'OS', { value: originalPlatform, configurable: true })
  })

  beforeEach(() => {
    jest.useFakeTimers()
    mockUseIsFocused.mockReturnValue(true)
    mockCountryParam = 'belarus'
    mockLocale = 'ru'
    mockUseRealSeo = false
    mockQuests = mockCountryQuests
    resetHeadManagerForTests()
    window.history.replaceState(null, '', '/quests/country/belarus')
    mockReplace.mockClear()
    document.head.innerHTML = [
      `<meta name="description" content="${GENERIC_DESCRIPTION}">`,
      '<meta name="description" content="Generic duplicate">',
      `<meta property="og:description" content="${GENERIC_DESCRIPTION}">`,
      '<meta property="og:description" content="Generic duplicate">',
      `<meta name="twitter:description" content="${GENERIC_DESCRIPTION}">`,
      '<meta name="twitter:description" content="Generic duplicate">',
      `<meta property="og:url" content="${GENERIC_OG_URL}">`,
      '<meta property="og:url" content="https://metravel.by/duplicate">',
    ].join('')
  })

  afterEach(() => {
    document.head.innerHTML = ''
    jest.useRealTimers()
  })

  it.each(['ru', 'be', 'uk', 'pl', 'en'])('keeps one robots through real Helmet and country navigation (%s, #3444)', async (locale) => {
    mockLocale = locale
    mockUseRealSeo = true
    // Два города в обеих странах: Norway — тонкий хаб, Spain — ровно порог.
    const { QUEST_COUNTRY_HUB_MIN_QUESTS, buildQuestCountryLandingGroups, questCountryHubIndexVerdict } = require('@/utils/questCountryLanding')
    mockQuests = [
      ...Array.from({ length: 2 }, (_, index) => ({ id: `no-${index}`, cityId: `no-${index}`, cityAlias: `norway-city-${index}`, cityName: `Norway city ${index}`, countryCode: 'NO', countryName: 'Norway', title: `Norway quest ${index}` })),
      ...Array.from({ length: QUEST_COUNTRY_HUB_MIN_QUESTS }, (_, index) => ({ id: `es-${index}`, cityId: `es-${index % 2}`, cityAlias: `spain-city-${index % 2}`, cityName: `Spain city ${index % 2}`, countryCode: 'ES', countryName: 'Spain', title: `Spain quest ${index}` })),
    ]
    const groups = buildQuestCountryLandingGroups(mockQuests, { locale })
    expect(questCountryHubIndexVerdict(groups.find((country: { countryCode: string }) => country.countryCode === 'NO')).reason).toBe('thin-hub')
    expect(questCountryHubIndexVerdict(groups.find((country: { countryCode: string }) => country.countryCode === 'ES')).reason).toBe('hub')
    mockCountryParam = 'norway'
    window.history.replaceState(null, '', '/quests/country/norway')
    document.head.innerHTML = '<meta data-rh="true" name="robots" content="noindex, follow">'
    const screen = await render(<QuestsByCountryScreen />)
    const expectRobots = (content: string) => {
      const nodes = document.head.querySelectorAll('meta[name="robots"]')
      expect(nodes).toHaveLength(1)
      expect(nodes[0].getAttribute('content')).toBe(content)
      expect(nodes[0].hasAttribute('data-rh')).toBe(false)
    }
    expectRobots('noindex, follow')

    mockCountryParam = 'spain'
    window.history.pushState(null, '', '/quests/country/spain')
    await screen.rerender(<QuestsByCountryScreen />)
    expectRobots('index, follow')

    mockCountryParam = 'norway'
    window.history.pushState(null, '', '/quests/country/norway')
    await screen.rerender(<QuestsByCountryScreen />)
    expectRobots('noindex, follow')
  })

  it('keeps the verdict when the SSR document hands head ownership to the country screen (#3444)', async () => {
    mockUseRealSeo = true
    document.head.innerHTML = '<meta name="robots" content="noindex, follow">'
    const InstantSEO = jest.requireActual('@/components/seo/LazyInstantSEO').default
    const screen = await render(<InstantSEO title="Server country" robots="noindex, follow" />)
    await screen.rerender(<QuestsByCountryScreen />)
    const robots = document.head.querySelectorAll('meta[name="robots"]')
    expect(robots).toHaveLength(1)
    expect(robots[0].getAttribute('content')).toBe('noindex, follow')
  })

  it('deduplicates country descriptions and restores the previous head on blur', async () => {
    const screen = await render(<QuestsByCountryScreen />)
    expectSingleDescriptionSet(COUNTRY_DESCRIPTION)
    expectSingleOgUrl(COUNTRY_OG_URL)

    mockUseIsFocused.mockReturnValue(false)
    await screen.rerender(<QuestsByCountryScreen />)
    expectSingleDescriptionSet(GENERIC_DESCRIPTION)
    expectSingleOgUrl(GENERIC_OG_URL)

    mockUseIsFocused.mockReturnValue(true)
    await screen.rerender(<QuestsByCountryScreen />)
    expectSingleDescriptionSet(COUNTRY_DESCRIPTION)
    expectSingleOgUrl(COUNTRY_OG_URL)

    await screen.unmount()
    expectSingleDescriptionSet(GENERIC_DESCRIPTION)
    expectSingleOgUrl(GENERIC_OG_URL)
  })

  it('removes country descriptions on blur when the previous head had none', async () => {
    document.head.innerHTML = ''
    const screen = await render(<QuestsByCountryScreen />)
    expectSingleDescriptionSet(COUNTRY_DESCRIPTION)
    expectSingleOgUrl(COUNTRY_OG_URL)

    mockUseIsFocused.mockReturnValue(false)
    await screen.rerender(<QuestsByCountryScreen />)
    for (const selector of DESCRIPTION_SELECTORS) {
      expect(document.querySelectorAll(selector)).toHaveLength(0)
    }
    expect(document.querySelectorAll('meta[property="og:url"]')).toHaveLength(0)
  })

  // #2087: SSG-блок страны — сосед #root, гидратация его не снимает, а стиль
  // `rnw-styles-ready` только прячет. Без снятия в DOM оставался второй, скрытый H1.
  it('keeps one runtime H1 and removes only the stale SSG country section', async () => {
    document.body.innerHTML = [
      '<section data-ssg-quest-country="true"><h1>Static country heading</h1></section>',
      '<h1 data-unrelated-heading="true">Unrelated heading</h1>',
    ].join('')
    document.head.insertAdjacentHTML(
      'beforeend',
      '<style data-ssg-quest-country-style="true">[data-ssg-quest-country]{display:none}</style>',
    )

    const { container } = await render(<QuestsByCountryScreen />)

    expect(document.querySelector('section[data-ssg-quest-country="true"]')).toBeNull()
    expect(document.querySelector('style[data-ssg-quest-country-style="true"]')).toBeNull()
    expect(document.querySelector('h1[data-unrelated-heading="true"]')?.textContent).toBe('Unrelated heading')
    expect(
      container.queryAll((node) =>
        node.props.accessibilityRole === 'header' && node.props['aria-level'] === 1,
      ),
    ).toHaveLength(1)
    document.body.innerHTML = ''
  })

  it('keeps the static country section while the screen is not focused', async () => {
    mockUseIsFocused.mockReturnValue(false)
    document.body.innerHTML =
      '<section data-ssg-quest-country="true"><h1>Static country heading</h1></section>'

    await render(<QuestsByCountryScreen />)

    expect(document.querySelector('section[data-ssg-quest-country="true"]')).not.toBeNull()
    document.body.innerHTML = ''
  })

  // #2896: вместо ухода в каталог — экран «не найдено» без canonical (noindex),
  // а не индексируемая пустая посадочная.
  it('shows the not-found screen for an unknown alias instead of an indexable empty page (#2896)', async () => {
    // Ленивый экран «не найдено» резолвится промисом; фейковые таймеры набора его не пропускают.
    jest.useRealTimers()
    mockCountryParam = 'unknown-country'
    const screen = await render(<QuestsByCountryScreen />)

    expect(await screen.findByTestId('quest-not-found')).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
    expect(document.querySelector('link[rel="canonical"]')).toBeNull()
  })

  // #2090: «назад» в браузере (popstate → resetRoot к записи истории до первого
  // визита) сбрасывает параметры скрытого, ещё смонтированного экрана таба в пустые.
  // Пустой алиас скрытого экрана — не «страна не найдена».
  it('keeps a hidden country landing with a history-reset alias from redirecting', async () => {
    const screen = await render(<QuestsByCountryScreen />)

    mockUseIsFocused.mockReturnValue(false)
    mockCountryParam = ''
    await screen.rerender(<QuestsByCountryScreen />)

    mockUseIsFocused.mockReturnValue(true)
    mockCountryParam = 'belarus'
    await screen.rerender(<QuestsByCountryScreen />)

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('never redirects an unknown alias, focused or hidden (#2896)', async () => {
    // Ленивый экран «не найдено» резолвится промисом; фейковые таймеры набора его не пропускают.
    jest.useRealTimers()
    mockUseIsFocused.mockReturnValue(false)
    mockCountryParam = 'unknown-country'
    const screen = await render(<QuestsByCountryScreen />)

    mockUseIsFocused.mockReturnValue(true)
    await screen.rerender(<QuestsByCountryScreen />)
    expect(await screen.findByTestId('quest-not-found')).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
