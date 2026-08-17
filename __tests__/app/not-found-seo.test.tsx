/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render } from '@testing-library/react-native'

const mockSeoProps = jest.fn()

// Глобальный мок `expo-router` в `__tests__/setup.ts` не отдаёт `Stack` —
// экрану он нужен только ради заголовка вкладки, к SEO-разметке отношения не имеет.
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}))

jest.mock('@/components/seo/LazyInstantSEO', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockSeoProps(props)
    return null
  },
}))

import NotFoundScreen from '@/app/[...missing]'

describe('not-found SEO guard', () => {
  beforeEach(() => {
    mockSeoProps.mockClear()
    render(<NotFoundScreen />)
  })

  it('marks the catch-all missing route as noindex', () => {
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
    expect(mockSeoProps.mock.calls[0][0].canonical).toBeUndefined()
  })
})
