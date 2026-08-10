import { Platform } from 'react-native'
import { render, fireEvent } from '@testing-library/react-native'

import { AffiliateSection } from '@/components/travel/details/sections/AffiliateSection'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrlInNewTab: jest.fn(),
}))
jest.mock('@/utils/analytics', () => ({
  queueAnalyticsEvent: jest.fn(),
}))

/** URL, с которым CTA «Подобрать жильё» ушёл во внешний браузер. */
const hotelsDestination = () => {
  const calls = (openExternalUrlInNewTab as jest.Mock).mock.calls
  return String(calls[calls.length - 1]?.[0] ?? '')
}

const styles = {
  sectionContainer: {},
  contentStable: {},
  webDeferredSection: {},
  sectionHeaderText: {},
  sectionSubtitle: {},
}

const travel = {
  id: 384,
  cityName: 'Минск',
  countryName: 'Беларусь',
  countryCode: 'BY',
  travelAddress: [{ id: 1, address: 'Минск', coord: '53.9,27.56' }],
} as any

describe('AffiliateSection native', () => {
  const originalPlatform = Platform.OS
  const originalEnv = { ...process.env }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(Platform as any).OS = 'ios'
    process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER = 'test-marker'
    process.env.EXPO_PUBLIC_AFFILIATE_TOURS_TEMPLATE =
      'https://tp.media/r?marker={subid}&u={url}'
    process.env.EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE =
      'https://tp.media/h?marker={subid}&u={url}'
  })

  afterEach(() => {
    ;(Platform as any).OS = originalPlatform
    process.env = { ...originalEnv }
  })

  it('renders partner travel offers on native when affiliate config is enabled', () => {
    const { getByText } = render(<AffiliateSection travel={travel} styles={styles} />)

    expect(getByText('Полезное в поездку')).toBeTruthy()
    expect(getByText('Экскурсии и гиды')).toBeTruthy()
    expect(getByText('Где остановиться')).toBeTruthy()
  })

  // `cityName` приходит из обратного геокодинга первой точки, а не как название
  // города, поэтому в подписи офферов должна стоять страна — как и в ссылке.
  it('labels offers with the country, never with the reverse-geocoded address', () => {
    const addressTravel = {
      id: 485,
      cityName:
        'Базилика Святого Стефана, 1, Szent István tér, Lipótváros, 5th district, Будапешт, Центральная Венгрия, 1051, Венгрия',
      countryName: 'Венгрия',
      countryCode: 'hu',
      travelAddress: [{ id: 1, address: 'Базилика Святого Стефана', coord: '47.5007615,19.0539858' }],
    } as any

    const { getAllByText, queryByText } = render(
      <AffiliateSection travel={addressTravel} styles={styles} />,
    )

    expect(getAllByText(/— Венгрия$/).length).toBe(2)
    expect(queryByText(/Szent István tér/)).toBeNull()
  })

  // Фикстура `travel` выше выглядит «нормальной» (cityName='Минск'), но и она
  // приходит из того же поля: место в подписи обязано быть страной, иначе копия
  // разойдётся со страновой ссылкой Ostrovok/Tripster.
  it('labels offers with the country even when cityName looks like a real city', () => {
    const { getAllByText, queryByText } = render(<AffiliateSection travel={travel} styles={styles} />)

    expect(getAllByText(/— Беларусь$/).length).toBe(2)
    expect(queryByText(/— Минск$/)).toBeNull()
  })

  // Мульти-страновые маршруты отдают countryName списком, а партнёрская ссылка
  // всегда одностранная (по countryCode первой точки). Обещать список нельзя.
  it('drops the place from the copy when countryName is a list of countries', () => {
    const multiCountry = {
      id: 213,
      cityName: 'Тбилисский ботанический сад, Ботаническая улица, Тбилиси, Грузия',
      countryName: 'Украина, Грузия',
      countryCode: 'ua, ge',
      travelAddress: [{ id: 1, address: 'Тбилисский ботанический сад', coord: '41.6873906,44.8022161' }],
    } as any

    const { getByText, queryByText } = render(
      <AffiliateSection travel={multiCountry} styles={styles} />,
    )

    expect(getByText('Экскурсии и гиды')).toBeTruthy()
    expect(queryByText(/Украина/)).toBeNull()
    expect(queryByText(/Грузия/)).toBeNull()
  })

  // Регресс: гейт показа обязан смотреть на сырое countryName. У travel 162
  // «Литва, Швеция, Норвегия, Дания, Германия, Польша» первая точка стоит в
  // Норвегии, которой нет в таблице bbox, поэтому код не резолвится и очищенный
  // `country` пуст — но блок там был и должен остаться, иначе монетизационная
  // поверхность молча исчезает со страницы.
  it('keeps the block when the country list is unresolvable to a single code', () => {
    const scandinavia = {
      id: 162,
      cityName: 'Bergen, Vestland, Norge',
      countryName: 'Литва, Швеция, Норвегия, Дания, Германия, Польша',
      countryCode: 'lt, se, no, dk, de, pl',
      travelAddress: [{ id: 1, address: 'Bergen', coord: '60.4162572,5.4757361' }],
    } as any

    const { getByText, queryByText } = render(
      <AffiliateSection travel={scandinavia} styles={styles} />,
    )

    expect(getByText('Экскурсии и гиды')).toBeTruthy()
    expect(getByText('Где остановиться')).toBeTruthy()
    expect(queryByText(/Норвегия|Литва|Швеция/)).toBeNull()
  })

  // Ссылка, а не только копия: для списка стран страна первой точки годится
  // лишь тогда, когда она в этом же списке объявлена.
  it('deep-links to the first point country when it is one of the declared ones', () => {
    const poland = {
      id: 640,
      cityName: 'Rynek Główny, Kraków, Polska',
      countryName: 'Польша, Чехия',
      countryCode: 'pl, cz',
      travelAddress: [{ id: 1, address: 'Rynek Główny', coord: '50.0647,19.945' }],
    } as any

    const { getByText } = render(<AffiliateSection travel={poland} styles={styles} />)
    fireEvent.press(getByText('Подобрать жильё'))

    expect(hotelsDestination()).toContain(encodeURIComponent('https://ostrovok.ru/hotel/poland/'))
  })

  it('falls back to the partner homepage when the first point is outside the declared list', () => {
    const georgia = {
      id: 213,
      cityName: 'Тбилисский ботанический сад, Тбилиси, Грузия',
      countryName: 'Украина, Грузия',
      countryCode: 'ua, ge',
      // Тбилиси лежит в bbox России (известное ограничение utils/geoCountry.ts),
      // RU в списке не объявлен — значит гадание отбрасывается целиком.
      travelAddress: [{ id: 1, address: 'Тбилисский ботанический сад', coord: '41.6873906,44.8022161' }],
    } as any

    const { getByText } = render(<AffiliateSection travel={georgia} styles={styles} />)
    fireEvent.press(getByText('Подобрать жильё'))

    expect(hotelsDestination()).toContain(encodeURIComponent('https://ostrovok.ru/'))
    expect(hotelsDestination()).not.toContain('%2Fhotel%2F')
  })
})
