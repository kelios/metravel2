import { act, fireEvent, render } from '@testing-library/react-native'
import { Link } from 'expo-router'

import ContributionBanner from '@/components/common/ContributionBanner'
import { i18n } from '@/i18n'
import { useAuthStore } from '@/stores/authStore'
import { queueAnalyticsEvent } from '@/utils/analytics'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  Link: jest.fn(({ children, href: _href, asChild: _asChild, ...props }) =>
    require('react').cloneElement(children, props)),
}))
jest.mock('@/stores/authStore', () => ({ useAuthStore: jest.fn() }))
jest.mock('@/utils/analytics', () => ({ queueAnalyticsEvent: jest.fn(), sendAnalyticsEvent: jest.fn() }))

const mockAuthStore = useAuthStore as unknown as jest.Mock
const mockQueue = queueAnalyticsEvent as jest.Mock

describe('author ContributionBanner variants', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    await i18n.changeLanguage('ru')
    mockAuthStore.mockImplementation((select) => select({ isAuthenticated: false }))
  })
  afterEach(async () => { await act(async () => { await i18n.changeLanguage('ru') }) })

  it.each([
    ['author-home', 'home'],
    ['author-catalog', 'travelsby'],
  ] as const)('links %s to the public landing and identifies the source once', async (variant, source) => {
    const screen = await render(<ContributionBanner variant={variant} />)
    expect((Link as unknown as jest.Mock).mock.calls.at(-1)?.[0].href).toBe('/become-author')
    expect(screen.queryByRole('button')).toBeNull()
    expect(mockQueue).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByRole('link'))
    expect(mockQueue).toHaveBeenCalledTimes(1)
    expect(mockQueue).toHaveBeenCalledWith('content_create_cta_click', {
      content_type: 'route', source, auth_state: 'guest', intent: 'create-travel', action: 'learn_more', variant,
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('keeps an existing guest search banner on its registration and login destinations', async () => {
    const screen = await render(<ContributionBanner variant="search" />)
    await fireEvent.press(screen.getByRole('button', { name: 'Зарегистрироваться и добавить место' }))
    expect(new URL(mockPush.mock.calls[0][0], 'https://metravel.by').pathname).toBe('/registration')
    await fireEvent.press(screen.getByRole('button', { name: 'Добавить место на карту' }))
    expect(new URL(mockPush.mock.calls[1][0], 'https://metravel.by').pathname).toBe('/login')
    expect(Link).not.toHaveBeenCalled()
  })

  it('keeps an existing authenticated banner on creation', async () => {
    mockAuthStore.mockImplementation((select) => select({ isAuthenticated: true }))
    const screen = await render(<ContributionBanner variant="about" />)
    await fireEvent.press(screen.getByRole('button', { name: 'Добавить место на карту' }))
    expect(mockPush).toHaveBeenCalledWith('/travel/new')
  })

  it('updates the author invitation without remounting after a locale change', async () => {
    const screen = await render(<ContributionBanner variant="author-home" />)
    await act(async () => { await i18n.changeLanguage('pl') })
    expect(screen.getByText('Zostań autorem')).toBeTruthy()
    expect(screen.queryByText('Стать автором')).toBeNull()
  })
})
