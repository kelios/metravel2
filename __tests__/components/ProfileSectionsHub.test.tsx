import { fireEvent, render } from '@testing-library/react-native'

import { ProfileSectionsHub } from '@/components/screens/profile/ProfileSectionsHub'

let mockResponsive = { isDesktop: true, isMobile: false, isHydrated: true }
const mockPush = jest.fn()

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockResponsive,
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () =>
    new Proxy({}, { get: () => '#000' }) as unknown as Record<string, string>,
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('@expo/vector-icons/Feather', () => 'Feather')

jest.mock(
  '@/components/profile/ProfileSectionHeader',
  () => 'ProfileSectionHeader',
)

describe('ProfileSectionsHub — экспорт в PDF на мобильном', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it('скрывает «Экспорт в PDF» в мобильной версии сайта', () => {
    mockResponsive = { isDesktop: false, isMobile: true, isHydrated: true }
    const { queryByText } = render(<ProfileSectionsHub userId="1" />)
    expect(queryByText('Экспорт в PDF')).toBeNull()
  })

  it('показывает «Экспорт в PDF» на десктопе (без изменений)', () => {
    mockResponsive = { isDesktop: true, isMobile: false, isHydrated: true }
    const { queryByText } = render(<ProfileSectionsHub userId="1" />)
    expect(queryByText('Экспорт в PDF')).not.toBeNull()
  })

  it('до гидрации показывает пункт даже на мобильном (нет hydration mismatch)', () => {
    mockResponsive = { isDesktop: false, isMobile: true, isHydrated: false }
    const { queryByText } = render(<ProfileSectionsHub userId="1" />)
    expect(queryByText('Экспорт в PDF')).not.toBeNull()
  })

  it('открывает приватность из профиля с явным источником для стабильного Android Back', () => {
    mockResponsive = { isDesktop: false, isMobile: true, isHydrated: true }
    const { getByLabelText } = render(<ProfileSectionsHub userId="1" />)

    fireEvent.press(getByLabelText('Приватность'))

    expect(mockPush).toHaveBeenCalledWith('/privacy-settings?from=profile')
  })
})
