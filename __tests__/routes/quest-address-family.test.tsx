/**
 * @jest-environment jsdom
 *
 * #3227: семейство адресов квеста под одним контрактом (`utils/questAddressState.ts`).
 * Каждая форма адреса — `/quests/<city>/<slug>`, `/{locale}/quests/<city>/<slug>`,
 * `/quests/<slug>`, `/quests/country/<alias>` — прогоняется на настоящих хуках
 * данных с подменённым API-слоем: ответ 404 даёт экран «не найдено», сбой
 * (5xx, обрыв сети) — экран ошибки с «Повторить», и ни в одном состоянии на
 * экран не попадает текст бэкенда.
 */
import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { translate as i18nT } from '@/i18n'

const BACKEND_TEXT = 'error: Quest with quest_id=no-such-quest-xyz not found'
const apiError = (status: number, message = BACKEND_TEXT) =>
  Object.assign(new Error(message), { name: 'ApiError', status })

let mockParams: Record<string, string> = {}
const mockFetchQuestByQuestId = jest.fn()
const mockFetchQuestsList = jest.fn()
const mockUseQuestServing = jest.fn((_options: unknown) => ({ projection: null, pending: false, offline: false, refetch: jest.fn() }))

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useIsFocused: () => true,
  useNavigation: () => ({ setOptions: jest.fn() }),
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  Stack: { Screen: () => null },
  Link: ({ children }: { children?: React.ReactNode }) => children ?? null,
}))
jest.mock('expo-router/head', () => ({ __esModule: true, default: () => null }))
jest.mock('@expo/vector-icons/Feather', () => () => null)

jest.mock('@/api/quests', () => ({
  fetchQuestByQuestId: (...args: unknown[]) => mockFetchQuestByQuestId(...args),
  fetchQuestsList: (...args: unknown[]) => mockFetchQuestsList(...args),
  fetchQuestsByCity: jest.fn(async () => []),
}))
jest.mock('@/api/questBundleCache', () => ({ writeCachedQuestBundle: jest.fn() }))
jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isConnected: true, isInternetReachable: true, type: 'unknown' }),
}))
// Данные адреса идут через настоящие хуки; прогресс к контракту адреса не относится.
jest.mock('@/hooks/useQuestsApi', () => ({
  ...jest.requireActual('@/hooks/useQuestsApi'),
  useQuestProgressSync: () => ({
    progress: null, progressLoading: false, progressMissing: false, saveProgress: jest.fn(), resetProgress: jest.fn(),
  }),
}))

jest.mock('@/hooks/useQuestServing', () => ({ useQuestServing: (options: unknown) => mockUseQuestServing(options) }))
jest.mock('@/hooks/useQuestVersionNavigation', () => ({ usePublishQuestVersionNavigation: jest.fn() }))
jest.mock('@/hooks/useQuestRatingMeta', () => ({ useQuestRatingMeta: () => ({ ratingAvg: null, ratingCount: 0 }) }))
jest.mock('@/hooks/useQuestReview', () => ({ useQuestReview: () => ({ review: null, isLoading: false }) }))
jest.mock('@/hooks/useQuestCompletionMeta', () => ({
  useQuestCompletionMeta: () => ({ isCompletedByMe: false, completionsCount: 0 }),
}))
jest.mock('@/hooks/useQuestPioneerMeta', () => ({ useQuestPioneerMeta: () => null }))
jest.mock('@/hooks/useQuestCityWalk', () => ({ useQuestCityWalk: () => ({ walk: null, settled: true }) }))
jest.mock('@/hooks/useResponsive', () => ({
  useBreakpoints: () => ({ isMobile: false, width: 1280 }),
  useResponsive: () => ({ isMobile: false }),
}))
jest.mock('@/i18n/LocaleProvider', () => ({
  useLocale: () => ({ locale: 'ru' }),
  useTranslation: () => ({ t: jest.requireActual('@/i18n').translate }),
}))
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: false, userId: null }) }))
jest.mock('@/components/quests/useGuestQuestFlow', () => ({
  useGuestQuestFlow: () => ({
    guestInitial: null, guestReady: true, guestFreeSteps: 2,
    persistGuestProgress: jest.fn(), goToLogin: jest.fn(), goToRegister: jest.fn(),
  }),
}))
jest.mock('@/components/quests/QuestWizard', () => ({ QuestWizard: () => null }))
jest.mock('@/components/quests/TravelsForQuestSection', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/quests/QuestCityLandingSections', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/quests/QuestCountryLandingSections', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/quests/QuestVersionLinks', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/seo/LazyInstantSEO', () => ({ __esModule: true, default: () => null }))
jest.mock('@/screens/tabs/QuestsScreenRoute', () => ({ __esModule: true, default: () => null }))
jest.mock('@/screens/tabs/QuestsScreen.styles', () => ({ getStyles: () => ({ root: {}, questsGrid: {} }) }))

// Экраны состояний — заглушки-маркеры: сами экраны покрыты своими тестами
// (`QuestNotFoundScreen.test.tsx`), здесь проверяется, КАКОЕ состояние выбрал маршрут.
jest.mock('@/components/quests/QuestAddressNotFound', () => {
  const { createElement } = jest.requireActual('react')
  const { Text: RNText } = jest.requireActual('react-native')
  return {
    __esModule: true,
    default: ({ segment }: { segment: string }) =>
      createElement(RNText, { testID: 'quest-not-found' }, `quest:${segment}`),
  }
})
jest.mock('@/components/quests/QuestNotFoundScreen', () => {
  const { createElement } = jest.requireActual('react')
  const { Text: RNText } = jest.requireActual('react-native')
  return {
    __esModule: true,
    default: ({ kind, segment }: { kind: string; segment: string }) =>
      createElement(RNText, { testID: 'quest-not-found' }, `${kind}:${segment}`),
  }
})
jest.mock('@/components/quests/QuestLandingLoadError', () => {
  const { createElement } = jest.requireActual('react')
  const { Pressable } = jest.requireActual('react-native')
  return {
    __esModule: true,
    default: ({ onRetry }: { onRetry: () => void }) =>
      createElement(Pressable, { testID: 'quest-landing-load-error', onPress: onRetry }),
  }
})
jest.mock('@/components/quests/QuestLocaleUnavailable', () => {
  const { createElement } = jest.requireActual('react')
  const { Pressable } = jest.requireActual('react-native')
  return {
    __esModule: true,
    default: ({ temporary, onRetry }: { temporary: boolean; onRetry: () => void }) =>
      createElement(Pressable, { testID: temporary ? 'quest-locale-temporary' : 'quest-locale-unavailable', onPress: onRetry }),
  }
})

const API_META = {
  id: 1, quest_id: 'grodno-royal', title: 'Королевский Гродно', points: '7', city_id: '11', city_name: 'Гродно',
  country_code: 'BY', country_name: 'Беларусь', lat: '53.68', lng: '23.83', duration_min: 60, difficulty: 'easy',
  tags: null, pet_friendly: true, cover_url: null, content_locale: 'ru', available_locales: ['ru'],
}
const API_BUNDLE = {
  id: 1, quest_id: 'grodno-royal', title: 'Королевский Гродно', steps: [], finale: { text: '' }, intro: null,
  storage_key: 'grodno-royal', city: { id: 11, name: 'Гродно', lat: '53.68', lng: '23.83', country_code: 'BY' },
  content_locale: 'ru',
}

type ScreenModule = { default: React.ComponentType<Record<string, unknown>> }
let QuestScreen: ScreenModule['default']
let CityScreen: ScreenModule['default']
let CountryScreen: ScreenModule['default']

beforeAll(() => {
  const RN = require('react-native')
  RN.Platform.OS = 'web'
  RN.Platform.select = (obj: Record<string, unknown>) => obj.web || obj.default
  QuestScreen = require('@/app/(tabs)/quests/[city]/[questId]').default
  CityScreen = require('@/app/(tabs)/quests/[city]/index').default
  CountryScreen = require('@/app/(tabs)/quests/country/[country]/index').default
})

beforeEach(() => {
  mockFetchQuestByQuestId.mockReset()
  mockFetchQuestsList.mockReset()
  mockFetchQuestsList.mockResolvedValue([API_META])
  mockUseQuestServing.mockReset()
  mockUseQuestServing.mockReturnValue({ projection: null, pending: false, offline: false, refetch: jest.fn() })
})

const mount = async (element: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const screen = await render(<QueryClientProvider client={client}>{element}</QueryClientProvider>)
  return screen
}

/** Текст бэкенда не доходит до экрана ни строкой, ни фрагментом. */
const expectNoBackendText = (screen: Awaited<ReturnType<typeof render>>) => {
  const tree = JSON.stringify(screen.toJSON())
  expect(tree).not.toContain('Quest with quest_id')
  expect(tree).not.toContain('error:')
}

// Что отдаёт бэкенд на проде на адрес с языковым префиксом, когда пакета публикации нет.
const servingFailure = (locale: string) => ({
  projection: {
    schema_version: 1, release_id: null, city_id: 11, quest_slug: 'no-such-quest-xyz', locale,
    state: 'temporary_failure', canonical_path: null, ru_source_path: null, versions: [],
  },
  pending: false, offline: false, refetch: jest.fn(),
})

type Form = {
  name: string
  render: () => React.ReactElement
  /** Источник, который решает о существовании адреса. */
  source: jest.Mock
  /** Ответ источника «такого адреса нет». */
  missing: () => void
  notFoundLabel: string
  errorTestId: string
}

const FORMS: Form[] = [
  {
    name: '/quests/<city>/<slug>',
    render: () => {
      mockParams = { city: '11', questId: 'no-such-quest-xyz' }
      return <QuestScreen />
    },
    source: mockFetchQuestByQuestId,
    missing: () => mockFetchQuestByQuestId.mockRejectedValue(apiError(404)),
    notFoundLabel: 'quest:no-such-quest-xyz',
    errorTestId: 'quest-load-error',
  },
  ...(['be', 'uk', 'pl', 'en'] as const).map((locale): Form => ({
    name: `/${locale}/quests/<city>/<slug>`,
    render: () => {
      mockParams = {}
      mockUseQuestServing.mockReturnValue(servingFailure(locale))
      const route = { locale, cityId: 11, questSlug: 'no-such-quest-xyz', path: `/${locale}/quests/11/no-such-quest-xyz` }
      return <QuestScreen route={route} />
    },
    source: mockFetchQuestByQuestId,
    missing: () => mockFetchQuestByQuestId.mockRejectedValue(apiError(404)),
    notFoundLabel: 'quest:no-such-quest-xyz',
    errorTestId: 'quest-locale-temporary',
  })),
  {
    name: '/quests/<slug>',
    render: () => {
      mockParams = { city: 'no-such-quest-xyz' }
      return <CityScreen />
    },
    source: mockFetchQuestsList,
    // Каталог ответил, но такого города или alias квеста в нём нет.
    missing: () => mockFetchQuestsList.mockResolvedValue([API_META]),
    notFoundLabel: 'city:no-such-quest-xyz',
    errorTestId: 'quest-landing-load-error',
  },
  {
    name: '/quests/country/<alias>',
    render: () => {
      mockParams = { country: 'no-such-country' }
      return <CountryScreen />
    },
    source: mockFetchQuestsList,
    missing: () => mockFetchQuestsList.mockResolvedValue([API_META]),
    notFoundLabel: 'country:no-such-country',
    errorTestId: 'quest-landing-load-error',
  },
]

describe.each(FORMS)('адрес квеста $name', (form) => {
  it('источник ответил «нет такого адреса» — экран «не найдено», без «Повторить» и без текста бэкенда', async () => {
    form.missing()
    const screen = await mount(form.render())
    expect((await screen.findByTestId('quest-not-found')).props.children).toBe(form.notFoundLabel)
    expect(screen.queryByTestId(form.errorTestId)).toBeNull()
    expect(screen.queryByText(i18nT('quests:app.tabs.quests.city.questId.povtorit_35493473'))).toBeNull()
    expectNoBackendText(screen)
  })

  it.each([
    ['5xx', () => apiError(503, 'Service Unavailable: upstream connect error')],
    ['обрыв сети', () => apiError(0, 'Network request failed')],
    ['неизвестный статус', () => apiError(418, BACKEND_TEXT)],
  ])('сбой источника (%s) — экран ошибки с повтором, а не «не найдено»', async (_label, makeError) => {
    form.source.mockRejectedValue(makeError())
    const screen = await mount(form.render())
    const errorScreen = await screen.findByTestId(form.errorTestId)
    expect(screen.queryByTestId('quest-not-found')).toBeNull()
    expectNoBackendText(screen)

    // «Повторить» действительно перезапрашивает источник.
    const callsBefore = form.source.mock.calls.length
    const retry = screen.queryByText(i18nT('quests:app.tabs.quests.city.questId.povtorit_35493473')) ?? errorScreen
    await act(async () => { await fireEvent.press(retry) })
    await waitFor(() => expect(form.source.mock.calls.length).toBeGreaterThan(callsBefore))
  })
})

describe('адрес с языковым префиксом: «квеста нет» ≠ «перевода нет»', () => {
  it('квест существует, версии на языке нет — экран языковой версии, не «не найдено»', async () => {
    mockParams = {}
    mockUseQuestServing.mockReturnValue(servingFailure('en'))
    mockFetchQuestByQuestId.mockResolvedValue(API_BUNDLE)
    const route = { locale: 'en', cityId: 11, questSlug: 'grodno-royal', path: '/en/quests/11/grodno-royal' }
    const screen = await mount(<QuestScreen route={route} />)
    await screen.findByTestId('quest-locale-temporary')
    expect(screen.queryByTestId('quest-not-found')).toBeNull()
  })
})

describe('экран ошибки квеста', () => {
  it('показывает свой текст из i18n и ссылку в каталог вместо сообщения бэкенда', async () => {
    mockParams = { city: '11', questId: 'no-such-quest-xyz' }
    mockFetchQuestByQuestId.mockRejectedValue(apiError(500, 'Internal Server Error: traceback'))
    const screen = await mount(<QuestScreen />)
    await screen.findByTestId('quest-load-error')
    expect(screen.getByText(i18nT('quests:app.tabs.quests.city.questId.ne_udalos_zagruzit_kvest_37c9397e'))).toBeTruthy()
    expect(screen.getByText(i18nT('quests:app.tabs.quests.city.questId.loadErrorDescription'))).toBeTruthy()
    expect(screen.getByText(i18nT('quests:app.tabs.quests.city.questId.k_spisku_kvestov_27c3b0f7'))).toBeTruthy()
    expect(JSON.stringify(screen.toJSON())).not.toContain('traceback')
  })

  it('сегмент, из которого id не собрать, — «не найдено», а не ошибка с повтором (#1185)', async () => {
    mockParams = { city: 'undefined', questId: 'undefined' }
    mockFetchQuestByQuestId.mockRejectedValue(apiError(400, 'fetchQuestByQuestId: quest id is missing or invalid'))
    const screen = await mount(<QuestScreen />)
    expect((await screen.findByTestId('quest-not-found')).props.children).toBe('quest:undefined')
    expect(screen.queryByTestId('quest-load-error')).toBeNull()
  })
})
