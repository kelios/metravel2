import { fireEvent, render } from '@testing-library/react-native'
import { Platform, StyleSheet } from 'react-native'

import { ProfileSectionsHub } from '@/components/screens/profile/ProfileSectionsHub'

let mockResponsive = { isDesktop: true, isMobile: false, isHydrated: true }
const mockPush = jest.fn()

// #2119: в приложении плитка книги зависит от модуля печати (expo-print).
let mockPrintAvailable = true
jest.mock('@/utils/printAvailability', () => ({
  isPrintAvailable: () => mockPrintAvailable,
}))

const originalPlatform = Platform.OS
const setPlatform = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os })
}

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
    mockPrintAvailable = true
    setPlatform('web')
  })

  afterAll(() => {
    setPlatform(originalPlatform)
  })

  // Ширина плитки — стиль `Pressable` с `accessibilityRole="menuitem"`.
  const tileWidths = (view: ReturnType<typeof render>) =>
    view.getAllByRole('menuitem').map((tile) => {
      const style = typeof tile.props.style === 'function' ? tile.props.style({ pressed: false }) : tile.props.style
      return StyleSheet.flatten(style).width
    })

  it.each(['ios', 'android'] as const)('в приложении %s плитка есть и на телефоне — когда есть модуль печати (#2119)', (os) => {
    setPlatform(os)
    mockResponsive = { isDesktop: false, isMobile: true, isHydrated: true }
    const view = render(<ProfileSectionsHub userId="1" />)

    expect(view.queryByText('Экспорт в PDF')).not.toBeNull()
    // Плитка книги раскладку не меняет: на телефоне плитки по-прежнему в одну колонку.
    expect(new Set(tileWidths(view))).toEqual(new Set(['100%']))
  })

  it('раскладка плиток зависит от экрана, а не от плитки книги', () => {
    // Сайт, телефон: плитки книги нет, одна колонка.
    setPlatform('web')
    mockResponsive = { isDesktop: false, isMobile: true, isHydrated: true }
    expect(new Set(tileWidths(render(<ProfileSectionsHub userId="1" />)))).toEqual(new Set(['100%']))

    // Приложение на планшете без модуля печати: плитки книги нет, но колонок две.
    setPlatform('ios')
    mockPrintAvailable = false
    mockResponsive = { isDesktop: false, isMobile: false, isHydrated: true }
    const tablet = render(<ProfileSectionsHub userId="1" />)
    expect(tablet.queryByText('Экспорт в PDF')).toBeNull()
    expect(new Set(tileWidths(tablet))).toEqual(new Set(['48%']))

    // Десктоп: три колонки.
    setPlatform('web')
    mockPrintAvailable = true
    mockResponsive = { isDesktop: true, isMobile: false, isHydrated: true }
    expect(new Set(tileWidths(render(<ProfileSectionsHub userId="1" />)))).toEqual(new Set(['31.5%']))
  })

  it.each(['ios', 'android'] as const)('в сборке приложения %s без модуля печати плитки нет ни на каком экране', (os) => {
    setPlatform(os)
    mockPrintAvailable = false
    for (const responsive of [
      { isDesktop: false, isMobile: true, isHydrated: true },
      { isDesktop: true, isMobile: false, isHydrated: true },
    ]) {
      mockResponsive = responsive
      expect(render(<ProfileSectionsHub userId="1" />).queryByText('Экспорт в PDF')).toBeNull()
    }
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
