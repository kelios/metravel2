import { renderHook } from '@testing-library/react-native'
import { Animated } from 'react-native'

import { useTravelDetailsMenu } from '@/hooks/useTravelDetailsMenu'

describe('useTravelDetailsMenu', () => {
  const timingStart = jest.fn()

  beforeEach(() => {
    timingStart.mockReset()
    jest.spyOn(Animated, 'timing').mockReturnValue({
      start: timingStart,
    } as any)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('opens desktop menu after defer is allowed', () => {
    const { result } = renderHook(() => useTravelDetailsMenu(false, true, 1200))

    expect(result.current.isMenuOpen).toBe(true)
    expect(result.current.menuWidthNum).toBe(336)
  })

  it('does not open menu on mobile', () => {
    const { result } = renderHook(() => useTravelDetailsMenu(true, true, 390))

    expect(result.current.isMenuOpen).toBe(false)
    expect(result.current.menuWidth).toBe('100%')
  })

  it('does not open menu before defer is allowed', () => {
    const { result } = renderHook(() => useTravelDetailsMenu(false, false, 1200))

    expect(result.current.isMenuOpen).toBe(true)
    expect(timingStart).not.toHaveBeenCalled()
  })
})
