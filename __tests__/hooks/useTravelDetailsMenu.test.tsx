import { renderHook } from '@testing-library/react-native'

import { useTravelDetailsMenu } from '@/hooks/useTravelDetailsMenu'

jest.mock('@/hooks/useMenuState', () => ({
  useMenuState: jest.fn(),
}))

const useMenuState = jest.requireMock('@/hooks/useMenuState').useMenuState as jest.Mock

describe('useTravelDetailsMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('opens desktop menu after defer is allowed', () => {
    const openMenuOnDesktop = jest.fn()
    useMenuState.mockReturnValue({
      closeMenu: jest.fn(),
      animatedX: {},
      menuWidth: {},
      menuWidthNum: 320,
      openMenuOnDesktop,
    })

    renderHook(() => useTravelDetailsMenu(false, true))

    expect(openMenuOnDesktop).toHaveBeenCalledTimes(1)
  })

  it('does not open menu on mobile', () => {
    const openMenuOnDesktop = jest.fn()
    useMenuState.mockReturnValue({
      closeMenu: jest.fn(),
      animatedX: {},
      menuWidth: {},
      menuWidthNum: 320,
      openMenuOnDesktop,
    })

    renderHook(() => useTravelDetailsMenu(true, true))

    expect(openMenuOnDesktop).not.toHaveBeenCalled()
  })

  it('does not open menu before defer is allowed', () => {
    const openMenuOnDesktop = jest.fn()
    useMenuState.mockReturnValue({
      closeMenu: jest.fn(),
      animatedX: {},
      menuWidth: {},
      menuWidthNum: 320,
      openMenuOnDesktop,
    })

    renderHook(() => useTravelDetailsMenu(false, false))

    expect(openMenuOnDesktop).not.toHaveBeenCalled()
  })
})
