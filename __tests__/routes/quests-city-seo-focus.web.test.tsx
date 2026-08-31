/**
 * @jest-environment jsdom
 */

import React from 'react'
import { Platform, Text } from 'react-native'
import { render } from '@testing-library/react-native'

const mockUseIsFocused = jest.fn(() => true)

jest.mock('expo-router', () => ({
  Link: ({ children }: { children?: React.ReactNode }) => children ?? null,
  useIsFocused: () => mockUseIsFocused(),
  useLocalSearchParams: () => ({ city: 'rome' }),
  useNavigation: () => ({ setOptions: jest.fn() }),
  useRouter: () => ({ replace: jest.fn() }),
}))

jest.mock('@expo/vector-icons/Feather', () => () => null)

jest.mock('@/components/seo/LazyInstantSEO', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/quests/QuestCityLandingSections', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/quests/TravelsForQuestSection', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/screens/tabs/QuestCard', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/screens/tabs/questsShared', () => ({
  pluralizeQuest: (count: number) => `${count} quest`,
}))

jest.mock('@/screens/tabs/QuestsScreen.styles', () => ({
  getStyles: () => ({ root: {}, questsGrid: {} }),
}))

jest.mock('@/hooks/useQuestsApi', () => {
  const quests = [
    {
      id: 'rome-forum',
      cityId: '121',
      cityName: 'Рим',
      title: 'Квест по Риму: Форум',
      lat: 41.89,
      lng: 12.49,
    },
  ]

  return {
    useQuestsList: () => ({ loading: false, quests }),
  }
})

jest.mock('@/hooks/useQuestReturnVisit', () => ({
  useQuestReturnVisit: () => undefined,
}))

jest.mock('@/hooks/useQuestCatalogResponsiveModel', () => ({
  useQuestCatalogResponsiveModel: () => ({ cardWidth: 320 }),
}))

jest.mock('@/hooks/useResponsive', () => ({
  useBreakpoints: () => ({ width: 1280, isMobile: false }),
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    primary: '#227744',
    primaryDark: '#115533',
    primarySoft: '#e8f5ec',
    primaryAlpha30: '#2277444d',
    primaryText: '#174d2e',
    text: '#17251e',
    textMuted: '#5f756c',
    textSubtle: '#71857b',
  }),
}))

jest.mock('@/i18n/LocaleProvider', () => {
  const t = (key: string) => {
    if (key.endsWith('.metaDescription')) return 'City description'
    if (key.endsWith('.seoTitle')) return 'City title'
    return key
  }

  return {
    useTranslation: () => ({ t }),
  }
})

import QuestsByCityScreen from '@/app/(tabs)/quests/[city]/index'

const GENERIC_DESCRIPTION = 'Generic description'
const CITY_DESCRIPTION = 'City description'
const DESCRIPTION_SELECTORS = [
  'meta[name="description"]',
  'meta[property="og:description"]',
  'meta[name="twitter:description"]',
]

const expectSingleDescriptionSet = (content: string) => {
  for (const selector of DESCRIPTION_SELECTORS) {
    const nodes = document.querySelectorAll(selector)
    expect(nodes).toHaveLength(1)
    expect(nodes[0].getAttribute('content')).toBe(content)
  }
}

describe('quest city SEO focus lifecycle', () => {
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
    document.body.innerHTML = ''
    document.head.innerHTML = [
      `<meta name="description" content="${GENERIC_DESCRIPTION}">`,
      '<meta name="description" content="Generic duplicate">',
      `<meta property="og:description" content="${GENERIC_DESCRIPTION}">`,
      '<meta property="og:description" content="Generic duplicate">',
      `<meta name="twitter:description" content="${GENERIC_DESCRIPTION}">`,
      '<meta name="twitter:description" content="Generic duplicate">',
    ].join('')
  })

  afterEach(() => {
    document.head.innerHTML = ''
    jest.useRealTimers()
  })

  it('deduplicates focused city descriptions and restores the generic head across blur/refocus/unmount', () => {
    const screen = render(<QuestsByCityScreen />)

    expectSingleDescriptionSet(CITY_DESCRIPTION)

    mockUseIsFocused.mockReturnValue(false)
    screen.rerender(<QuestsByCityScreen />)
    expectSingleDescriptionSet(GENERIC_DESCRIPTION)

    mockUseIsFocused.mockReturnValue(true)
    screen.rerender(<QuestsByCityScreen />)
    expectSingleDescriptionSet(CITY_DESCRIPTION)

    screen.unmount()
    expectSingleDescriptionSet(GENERIC_DESCRIPTION)
  })

  it('removes city descriptions on blur when the previous head had none', () => {
    document.head.innerHTML = ''
    const screen = render(<QuestsByCityScreen />)

    expectSingleDescriptionSet(CITY_DESCRIPTION)

    mockUseIsFocused.mockReturnValue(false)
    screen.rerender(<QuestsByCityScreen />)
    for (const selector of DESCRIPTION_SELECTORS) {
      expect(document.querySelectorAll(selector)).toHaveLength(0)
    }
  })

  it('keeps one visible runtime H1 and removes only the stale shared SSG heading', () => {
    document.body.innerHTML = [
      '<section data-ssg-quest-city="true"><h1>Static city heading</h1></section>',
      '<h1 data-unrelated-heading="true">Unrelated heading</h1>',
    ].join('')
    document.head.insertAdjacentHTML(
      'beforeend',
      '<style data-ssg-quest-city-style="true">[data-ssg-quest-city]{display:none}</style>',
    )

    const { UNSAFE_root } = render(<QuestsByCityScreen />)

    expect(document.querySelector('section[data-ssg-quest-city="true"]')).toBeNull()
    expect(document.querySelector('style[data-ssg-quest-city-style="true"]')).toBeNull()
    expect(document.querySelector('h1[data-unrelated-heading="true"]')?.textContent).toBe('Unrelated heading')
    expect(
      UNSAFE_root.findAll((node) =>
        node.type === Text && node.props.accessibilityRole === 'header' && node.props['aria-level'] === 1,
      ),
    ).toHaveLength(1)
  })
})
