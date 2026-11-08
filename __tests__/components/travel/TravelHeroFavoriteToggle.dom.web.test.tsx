import type React from 'react'
import type { Root } from 'react-dom/client'

// #3144: the guest sign-in explanation under «Хочу поехать» is no longer
// permanent text. react-native-web 0.21 drops `accessibilityHint` (not in its
// `forwardedProps`), so the structural renderer alone would pass while the
// screen reader on web got nothing. This suite reads the real RN-web DOM
// (recipe of `__tests__/utils/webTitleRef.dom.web.test.tsx`).
let act: typeof import('react').act
let createElement: typeof import('react').createElement
let createRoot: typeof import('react-dom/client').createRoot
let TravelHeroFavoriteToggle: React.ComponentType<any>

const HINT = 'Войдите или зарегистрируйтесь, чтобы сохранить маршрут.'
const mockUseAuth = jest.fn()

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('@expo/vector-icons/Feather', () => ({ __esModule: true, default: () => null }))
  jest.doMock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
  jest.doMock('@/hooks/useTheme', () => {
    const { getThemedColors } = jest.requireActual('@/constants/designSystem')
    return { useThemedColors: () => getThemedColors(false) }
  })
  jest.doMock('@/components/travel/details/TravelDetailsHeroStyles', () => ({
    useTravelDetailsHeroStyles: () => ({}),
  }))
  jest.doMock('@/components/travel/details/hooks/useTravelHeroFavoriteToggleModel', () => ({
    useTravelHeroFavoriteToggleModel: () => ({
      favoriteButtonA11yLabel: 'Добавить в «Хочу поехать»',
      favoriteButtonLabel: 'Хочу поехать',
      handleFavoriteToggle: jest.fn(),
      isFavorite: false,
      isPending: false,
    }),
  }))
  ;({ act, createElement } = require('react'))
  ;({ createRoot } = require('react-dom/client'))
  ;({ TravelHeroFavoriteToggle } = require('@/components/travel/details/TravelHeroFavoriteToggle'))
})

describe('TravelHeroFavoriteToggle guest hint in the real RN-web DOM (#3144)', () => {
  let container: HTMLDivElement
  let root: Root

  const draw = async () => {
    await act(async () => {
      root.render(
        createElement(TravelHeroFavoriteToggle, {
          travel: { id: 1, slug: 'x', name: 'X' },
          isMobile: false,
        }),
      )
    })
    return container.querySelector('[data-testid="travel-first-screen-favorite"]')
  }

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('announces the sign-in hint to a guest without painting it', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false })
    const button = await draw()
    expect(button).not.toBeNull()
    expect(button!.getAttribute('aria-description')).toBe(HINT)
    expect(container.textContent).not.toContain(HINT)
  })

  it('drops the hint once the reader is signed in', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false })
    const button = await draw()
    expect(button!.getAttribute('aria-description')).toBe(HINT)

    mockUseAuth.mockReturnValue({ isAuthenticated: true })
    const same = await draw()
    expect(same).toBe(button)
    expect(same!.hasAttribute('aria-description')).toBe(false)
  })
})
