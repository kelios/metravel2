/**
 * @jest-environment jsdom
 */

import React from 'react'
import { Platform } from 'react-native'
import { render } from '@testing-library/react-native'

const mockReplace = jest.fn()
const mockSeoProps = jest.fn()

// Глобальный мок `expo-router` в `__tests__/setup.ts` не отдаёт `Stack` —
// экрану он нужен только ради заголовка вкладки, к SEO-разметке отношения не имеет.
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { push: jest.fn(), replace: (...args: unknown[]) => mockReplace(...args), back: jest.fn() },
}))

jest.mock('@/components/seo/LazyInstantSEO', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockSeoProps(props)
    return null
  },
}))

import NotFoundScreen from '@/app/[...missing]'
import { UNKNOWN_CITY_HYDRATION_STASH } from '@/utils/unknownCityNotFoundHydration'

describe('not-found SEO guard', () => {
  const originalPlatform = Platform.OS

  beforeEach(() => {
    mockSeoProps.mockClear()
    mockReplace.mockClear()
    delete (window as unknown as Record<string, unknown>)[UNKNOWN_CITY_HYDRATION_STASH]
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
  })

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatform, configurable: true })
    delete (window as unknown as Record<string, unknown>)[UNKNOWN_CITY_HYDRATION_STASH]
  })

  it('hands a stashed unknown-city URL back to the router after the not-found frame', () => {
    ;(window as unknown as Record<string, unknown>)[UNKNOWN_CITY_HYDRATION_STASH] = '/quests/no-such-city-x'
    const screen = render(<NotFoundScreen />)
    expect(screen.getByTestId('static-not-found')).toBeTruthy()
    expect(mockReplace).toHaveBeenCalledTimes(1)
    expect(mockReplace).toHaveBeenCalledWith('/quests/no-such-city-x')
    expect((window as unknown as Record<string, unknown>)[UNKNOWN_CITY_HYDRATION_STASH]).toBeUndefined()
  })

  it('marks the catch-all missing route as noindex', () => {
    render(<NotFoundScreen />)
    expect(mockSeoProps).toHaveBeenCalledTimes(1)
    expect(mockSeoProps.mock.calls[0][0]).toMatchObject({
      headKey: 'not-found',
      robots: 'noindex, nofollow',
    })
  })

  // #1441: экран экспортируется в один `+not-found.html`, который nginx отдаёт
  // на любой несуществующий адрес, поэтому build-time canonical не может быть
  // self-referential — он указывал на главную и давал роботам противоречивую
  // пару «noindex + canonical на `/`». Здесь его быть не должно вовсе: клиентам
  // с JS canonical/og:url на сам запрошенный URL проставляет критический скрипт
  // в `app/+html.tsx`.
  it('does not canonicalize the error page to another page', () => {
    render(<NotFoundScreen />)
    expect(mockSeoProps.mock.calls[0][0].canonical).toBeUndefined()
  })
})
