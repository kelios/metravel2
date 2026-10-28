import { act, fireEvent, render } from '@testing-library/react-native'

import TravelArticleShareTripCta from '@/components/travel/details/sections/TravelArticleShareTripCta'
import { useAuth } from '@/context/AuthContext'
import { i18n } from '@/i18n'
import type { Travel } from '@/types/types'
import { queueAnalyticsEvent } from '@/utils/analytics'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('@/context/AuthContext', () => ({ useAuth: jest.fn() }))

jest.mock('@/utils/analytics', () => ({
  queueAnalyticsEvent: jest.fn(),
  sendAnalyticsEvent: jest.fn(),
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => require('@/constants/modernMattePalette').MODERN_MATTE_PALETTE,
}))

const mockUseAuth = useAuth as jest.Mock
const mockQueue = queueAnalyticsEvent as jest.Mock
const actionLabel = 'Были здесь? Расскажите о своей поездке'
const fullActionLabel = 'Написать полную статью с маршрутом'

const travel = {
  id: 42,
  userIds: '7',
  name: 'Чужой заголовок статьи',
  countryCode: 'BY',
  cityName: 'Гродно',
  travelAddress: [{ id: 5, name: 'Старый замок' }],
} as Travel

describe('TravelArticleShareTripCta', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    await i18n.changeLanguage('ru')
    mockUseAuth.mockReturnValue({ authReady: true, isAuthenticated: false, userId: null })
  })

  afterEach(async () => {
    await act(async () => { await i18n.changeLanguage('ru') })
  })

  it('takes a guest to registration with the bounded note create URL and share intent', async () => {
    const screen = await render(<TravelArticleShareTripCta travel={travel} isMobile />)

    expect(mockQueue).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByRole('button', { name: actionLabel }))

    const authUrl = new URL(mockPush.mock.calls[0][0], 'https://metravel.by')
    expect(authUrl.pathname).toBe('/registration')
    expect(authUrl.searchParams.get('intent')).toBe('share-trip')
    const createUrl = new URL(authUrl.searchParams.get('redirect')!, 'https://metravel.by')
    expect(createUrl.pathname).toBe('/travel/new')
    expect(Object.fromEntries(createUrl.searchParams)).toEqual({
      mode: 'note',
      source_travel_id: '42',
      country: 'BY',
      place: 'Гродно',
    })
    expect(mockQueue).toHaveBeenCalledWith('content_create_cta_click', {
      content_type: 'route',
      source: 'travel_article',
      intent: 'share-trip',
      auth_state: 'guest',
      source_travel_id: '42',
      action: 'register',
      mode: 'note',
    })
    expect(mockQueue.mock.calls.some(([event]) => String(event).includes('favorite'))).toBe(false)
  })

  it('opens creation directly for a signed-in reader, including a superuser who is not the author', async () => {
    mockUseAuth.mockReturnValue({ authReady: true, isAuthenticated: true, userId: '8', isSuperuser: true })
    const screen = await render(<TravelArticleShareTripCta travel={travel} isMobile={false} />)

    await fireEvent.press(screen.getByRole('button', { name: actionLabel }))

    const createUrl = new URL(mockPush.mock.calls[0][0], 'https://metravel.by')
    expect(createUrl.pathname).toBe('/travel/new')
    expect(createUrl.searchParams.get('source_travel_id')).toBe('42')
    expect(createUrl.searchParams.get('place')).toBe('Гродно')
    expect(createUrl.searchParams.get('mode')).toBe('note')
    expect(mockQueue).toHaveBeenCalledWith('content_create_cta_click', expect.objectContaining({
      auth_state: 'authenticated',
      action: 'create',
      mode: 'note',
    }))
  })

  it('keeps the full wizard as the second choice with the same article context (#2829)', async () => {
    mockUseAuth.mockReturnValue({ authReady: true, isAuthenticated: true, userId: '8' })
    const screen = await render(<TravelArticleShareTripCta travel={travel} isMobile={false} />)

    await fireEvent.press(screen.getByRole('button', { name: fullActionLabel }))

    const createUrl = new URL(mockPush.mock.calls[0][0], 'https://metravel.by')
    expect(createUrl.pathname).toBe('/travel/new')
    expect(Object.fromEntries(createUrl.searchParams)).toEqual({
      source_travel_id: '42',
      country: 'BY',
      place: 'Гродно',
    })
    expect(mockQueue).toHaveBeenCalledWith('content_create_cta_click', expect.objectContaining({
      source: 'travel_article',
      action: 'create',
      mode: 'full',
    }))
  })

  it.each([
    ['userIds', travel],
    ['fallback user.id', { ...travel, userIds: '', user: { id: 7, name: 'Автор' } }],
  ])('hides the CTA from the author resolved through %s', async (_case, article) => {
    mockUseAuth.mockReturnValue({ authReady: true, isAuthenticated: true, userId: '7' })

    const screen = await render(<TravelArticleShareTripCta travel={article} isMobile />)

    expect(screen.queryByRole('button')).toBeNull()
    expect(mockQueue).not.toHaveBeenCalled()
  })

  it('waits for resolved authentication and does not flash a CTA for the author', async () => {
    mockUseAuth.mockReturnValue({ authReady: false, isAuthenticated: false, userId: null })
    const screen = await render(<TravelArticleShareTripCta travel={travel} isMobile />)
    expect(screen.queryByRole('button')).toBeNull()

    mockUseAuth.mockReturnValue({ authReady: true, isAuthenticated: true, userId: '7' })
    await await screen.rerender(<TravelArticleShareTripCta travel={{ ...travel }} isMobile />)

    expect(screen.queryByRole('button')).toBeNull()
    expect(mockQueue).not.toHaveBeenCalled()
  })

  it('waits for a signed-in reader identity before deciding whether the reader is the author', async () => {
    mockUseAuth.mockReturnValue({ authReady: true, isAuthenticated: true, userId: null })
    const screen = await render(<TravelArticleShareTripCta travel={travel} isMobile />)

    expect(screen.queryByRole('button')).toBeNull()
    expect(mockQueue).not.toHaveBeenCalled()
  })

  it('counts a visible impression once per article and re-arms after article navigation', async () => {
    const screen = await render(<TravelArticleShareTripCta travel={travel} isMobile />)
    expect(mockQueue).not.toHaveBeenCalled()

    await fireEvent(screen.getByTestId('travel-article-share-trip'), 'layout')
    await fireEvent(screen.getByTestId('travel-article-share-trip'), 'layout')
    expect(mockQueue).toHaveBeenCalledTimes(1)
    expect(mockQueue).toHaveBeenLastCalledWith('content_create_cta_impression', expect.objectContaining({
      source_travel_id: '42',
      auth_state: 'guest',
      intent: 'share-trip',
    }))

    await await screen.rerender(<TravelArticleShareTripCta travel={{ ...travel, id: 43 }} isMobile />)
    await fireEvent(screen.getByTestId('travel-article-share-trip'), 'layout')
    expect(mockQueue).toHaveBeenCalledTimes(2)
    expect(mockQueue).toHaveBeenLastCalledWith('content_create_cta_impression', expect.objectContaining({
      source_travel_id: '43',
    }))
  })

  it('still allows sharing when neither place nor country is available', async () => {
    const screen = await render(
      <TravelArticleShareTripCta
        travel={{ ...travel, cityName: '', countryCode: '', travelAddress: [] }}
        isMobile
      />,
    )

    await fireEvent.press(screen.getByRole('button', { name: actionLabel }))

    const authUrl = new URL(mockPush.mock.calls[0][0], 'https://metravel.by')
    const createUrl = new URL(authUrl.searchParams.get('redirect')!, 'https://metravel.by')
    expect(Object.fromEntries(createUrl.searchParams)).toEqual({ mode: 'note', source_travel_id: '42' })
    expect(createUrl.searchParams.get('place')).not.toBe(travel.name)
  })

  it('updates the visible label in all current locales without remounting the CTA', async () => {
    const screen = await render(<TravelArticleShareTripCta travel={travel} isMobile />)

    for (const locale of ['be', 'uk', 'pl', 'en', 'ru']) {
      await act(async () => { await i18n.changeLanguage(locale) })
      expect(screen.getByRole('button', { name: i18n.t('travel:articleShareTrip.action') })).toBeTruthy()
      expect(screen.getByRole('button', { name: i18n.t('travel:articleShareTrip.fullAction') })).toBeTruthy()
    }
    expect(mockQueue).not.toHaveBeenCalled()
  })
})
