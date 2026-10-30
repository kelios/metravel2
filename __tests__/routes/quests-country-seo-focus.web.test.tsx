/**
 * @jest-environment jsdom
 */

import React from 'react'
import { Platform } from 'react-native'
import { render } from '@testing-library/react-native'

const mockUseIsFocused = jest.fn(() => true)
const mockReplace = jest.fn()
let mockCountryParam = 'belarus'

jest.mock('expo-router', () => ({
  Link: ({ children }: { children?: React.ReactNode }) => children ?? null,
  useIsFocused: () => mockUseIsFocused(),
  useLocalSearchParams: () => ({ country: mockCountryParam }),
  useNavigation: () => ({ setOptions: jest.fn() }),
  useRouter: () => ({ replace: mockReplace }),
}))

jest.mock('@expo/vector-icons/Feather', () => () => null)
jest.mock('@/components/seo/LazyInstantSEO', () => ({ __esModule: true, default: () => null }))
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
  const quests = [
    {
      id: 'minsk-center',
      cityId: '4',
      cityName: 'Минск',
      countryCode: 'BY',
      countryName: 'Беларусь',
      title: 'Минский центр',
    },
  ]
  return {
    // Keep the catalog reference stable so this regression really proves that
    // the route's SEO effect responds to focus, not to an incidental rerender.
    useQuestsList: () => ({ loading: false, quests }),
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
    useLocale: () => ({ locale: 'ru' }),
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

  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
  })

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatform, configurable: true })
  })

  beforeEach(() => {
    jest.useFakeTimers()
    mockUseIsFocused.mockReturnValue(true)
    mockCountryParam = 'belarus'
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

  it('redirects an unknown alias instead of rendering an indexable empty page', async () => {
    mockCountryParam = 'unknown-country'
    await render(<QuestsByCountryScreen />)

    expect(mockReplace).toHaveBeenCalledWith('/quests')
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

  it('redirects an unknown alias only once its screen is focused', async () => {
    mockUseIsFocused.mockReturnValue(false)
    mockCountryParam = 'unknown-country'
    const screen = await render(<QuestsByCountryScreen />)
    expect(mockReplace).not.toHaveBeenCalled()

    mockUseIsFocused.mockReturnValue(true)
    await screen.rerender(<QuestsByCountryScreen />)
    expect(mockReplace).toHaveBeenCalledWith('/quests')
  })
})
