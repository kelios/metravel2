import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { Platform } from 'react-native'

jest.mock('@expo/vector-icons', () => ({ Feather: 'Feather' }))
jest.mock('@expo/vector-icons/Feather', () => 'Feather')
jest.mock('@/api/consent', () => ({ postConsentRecord: jest.fn().mockResolvedValue(undefined) }))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => new Proxy({}, { get: (_t, key) => String(key) }),
}))

jest.mock('@/components/ui/ImageCardMedia', () => 'ImageCardMedia')
jest.mock('@/utils/externalLinks', () => ({ openExternalUrl: jest.fn() }))
jest.mock('@/utils/tripAnalytics', () => ({ trackTripViewed: jest.fn() }))
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}))

const mockUsePublicTrip = jest.fn()
const mockUseTripApplications = jest.fn()
jest.mock('@/hooks/usePublicTripsApi', () => ({
  usePublicTrip: (...a: unknown[]) => mockUsePublicTrip(...a),
  useTripApplications: (...a: unknown[]) => mockUseTripApplications(...a),
  useDecideApplication: () => ({ mutate: jest.fn() }),
  useSubmitApplication: () => ({ mutate: jest.fn(), isPending: false }),
}))
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: true }),
}))
// TripTelegramGroupCard (внутри PublicTripDetail) использует React Query —
// мокаем хуки группы, чтобы не требовать QueryClientProvider в тесте.
jest.mock('@/hooks/useTripTelegramGroupApi', () => ({
  useTripTelegramGroup: () => ({ data: null, isLoading: false, isError: false }),
  useCreateTripTelegramGroup: () => ({ mutate: jest.fn(), isPending: false }),
  useFetchTripInviteLink: () => ({ mutate: jest.fn(), mutateAsync: jest.fn().mockResolvedValue(undefined), isPending: false }),
}))

import PublicTripDetail from '@/components/trips/PublicTripDetail'
import OrganizerApplicationsPanel from '@/components/trips/OrganizerApplicationsPanel'
import TripApplyForm from '@/components/trips/TripApplyForm'
import { CONSENT_TYPES, hasActionConsent, readActionConsentsSync } from '@/utils/actionConsent'

const baseTrip = {
  id: 1,
  title: 'Поездка',
  description: 'Описание',
  region: 'Минск',
  coverUrl: '',
  status: 'open',
  featured: false,
  tripType: null,
  organizer: { id: 9, name: 'Орг' },
  myApplicationStatus: 'approved',
  isOwner: false,
  meetingPoint: 'У вокзала, 10:00',
  contactNote: 'Telegram @org',
}

describe('PublicTripDetail — contact-exchange acknowledgment (#441)', () => {
  beforeEach(() => {
    ;(Platform as { OS: string }).OS = 'web'
    window.localStorage.clear()
    mockUsePublicTrip.mockReturnValue({ data: baseTrip, isLoading: false, isError: false })
    mockUseTripApplications.mockReturnValue({ data: [], isLoading: false, isError: false })
  })

  it('gates approved-participant contacts behind a «Понятно» ack, then reveals', async () => {
    const { getByTestId, queryByTestId, findByTestId } = render(<PublicTripDetail tripId={1} />)

    // Contacts hidden until acknowledged.
    expect(getByTestId('trip-contact-ack')).toBeTruthy()
    expect(queryByTestId('trip-reveal')).toBeNull()

    fireEvent.press(getByTestId('trip-contact-ack-confirm'))

    // Reveal shows and consent is recorded (grant() resolves async).
    expect(await findByTestId('trip-reveal')).toBeTruthy()
    expect(queryByTestId('trip-contact-ack')).toBeNull()
    expect(
      hasActionConsent(readActionConsentsSync(), CONSENT_TYPES.CONTACT_EXCHANGE),
    ).toBe(true)
  })

  it('shows owner their own meeting point without an ack gate', () => {
    mockUsePublicTrip.mockReturnValue({
      data: { ...baseTrip, isOwner: true, myApplicationStatus: null },
      isLoading: false,
      isError: false,
    })
    const { getByTestId, queryByTestId } = render(<PublicTripDetail tripId={1} />)

    expect(getByTestId('trip-reveal')).toBeTruthy()
    expect(queryByTestId('trip-contact-ack')).toBeNull()
  })
})

describe('TripApplyForm — consent before applying (#439)', () => {
  beforeEach(() => {
    ;(Platform as { OS: string }).OS = 'web'
    window.localStorage.clear()
  })

  it('blocks «Отправить заявку» until both consent checkboxes are checked', () => {
    const trip = { ...baseTrip, myApplicationStatus: null } as never
    const { getByTestId } = render(<TripApplyForm trip={trip} />)

    const submit = getByTestId('trip-apply-submit')
    fireEvent.changeText(getByTestId('trip-apply-message'), 'Хочу поехать с вами')

    // Message is valid but consent not given → still disabled.
    expect(submit.props.accessibilityState?.disabled).toBe(true)

    fireEvent(getByTestId('trip-apply-consent-rules'), 'onToggle', true)
    expect(submit.props.accessibilityState?.disabled).toBe(true)

    fireEvent(getByTestId('trip-apply-consent-disclaimer'), 'onToggle', true)
    expect(submit.props.accessibilityState?.disabled).toBe(false)
  })

  it('keeps submit enabled after consents and shows validation for a short message', () => {
    const trip = { ...baseTrip, myApplicationStatus: null } as never
    const { getByTestId, getByText } = render(<TripApplyForm trip={trip} />)

    fireEvent.changeText(getByTestId('trip-apply-message'), 'test')
    fireEvent(getByTestId('trip-apply-consent-rules'), 'onToggle', true)
    fireEvent(getByTestId('trip-apply-consent-disclaimer'), 'onToggle', true)

    const submit = getByTestId('trip-apply-submit')
    expect(submit.props.accessibilityState?.disabled).toBe(false)

    fireEvent.press(submit)

    expect(getByText(/минимум 10 символов/i)).toBeTruthy()
  })
})

describe('OrganizerApplicationsPanel — unverified socials warning (#442)', () => {
  it('warns that MeTravel does not verify applicant social accounts', () => {
    mockUseTripApplications.mockReturnValue({
      data: [
        {
          id: 5,
          status: 'new',
          message: 'Хочу поехать',
          socialLinks: ['https://instagram.com/user'],
          applicant: { name: 'Гость', activitySummary: '', badges: [] },
        },
      ],
      isLoading: false,
      isError: false,
    })
    const { getByTestId, getByText } = render(<OrganizerApplicationsPanel tripId={1} />)

    expect(getByTestId('trip-socials-unverified')).toBeTruthy()
    expect(getByText(/не проверяет подлинность аккаунтов/i)).toBeTruthy()
  })
})
