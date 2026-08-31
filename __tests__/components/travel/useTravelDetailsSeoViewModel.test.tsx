import { act, renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'

const mockIdleCallbacks: Array<() => void> = []
const mockCancelIdle = jest.fn()
const mockRIC = jest.fn((callback: () => void) => {
  mockIdleCallbacks.push(callback)
  return mockCancelIdle
})
jest.mock('@/utils/rIC', () => ({
  rIC: (callback: () => void, timeout: number) => mockRIC(callback, timeout),
}))

import { useTravelDetailsSeoViewModel } from '@/components/travel/details/hooks/useTravelDetailsContainerViewModel'

const travel = {
  id: 386,
  name: 'Energylandia — польский Диснейленд',
  slug: 'energylandia-polskiy-disneylend',
  description: '<p>Путешествие в Energylandia</p>',
  gallery: [],
}

describe('useTravelDetailsSeoViewModel (#1643)', () => {
  const originalPlatformOS = Platform.OS

  beforeEach(() => {
    mockIdleCallbacks.length = 0
    mockCancelIdle.mockClear()
    mockRIC.mockClear()
    Object.defineProperty(Platform, 'OS', { value: 'web' })
  })

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatformOS })
  })

  it('keeps SPA navigation metadata synchronous when no matching SSG preload exists', () => {
    const { result } = renderHook(() =>
      useTravelDetailsSeoViewModel(travel, travel.slug, false),
    )

    expect(result.current.readyTitle).toContain('Energylandia')
    expect(result.current.canonicalUrl).toContain(`/travels/${travel.slug}`)
    expect(mockRIC).not.toHaveBeenCalled()
  })

  it('defers only a direct preloaded article and cancels the idle job on cleanup', () => {
    const { result, unmount } = renderHook(() =>
      useTravelDetailsSeoViewModel(travel, travel.slug, true),
    )

    expect(result.current.readyTitle).toBeNull()
    expect(mockRIC).toHaveBeenCalledWith(expect.any(Function), 200)

    act(() => {
      mockIdleCallbacks[0]()
    })

    expect(result.current.readyTitle).toContain('Energylandia')
    unmount()
    expect(mockCancelIdle).toHaveBeenCalledTimes(1)
  })
})
