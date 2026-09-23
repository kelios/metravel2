// #2058: `[⌖]` дня поднимает мобильную страницу к карте на каждый рост
// `mapRevealToken`. Счётчик живёт в RouteBuilder и переживает раскладку, поэтому
// её повторный монтаж (смена ширины окна desktop ↔ mobile) скроллить не должен.
import React from 'react'
import { render } from '@testing-library/react-native'
import { Text } from 'react-native'

import RouteBuilderMobile from '@/components/trips/planning/RouteBuilderMobile'

const mockScrollPageTo = jest.fn()

jest.mock('@/components/trips/planning/PlannerPageScrollView', () => ({
  usePlannerPageScrollTo: () => mockScrollPageTo,
}))

const renderMobile = (mapRevealToken: number, key = 'layout') => (
  <RouteBuilderMobile
    key={key}
    mapSlot={null}
    mapRevealToken={mapRevealToken}
    summary={null}
    transport="foot"
  >
    <Text>panel</Text>
  </RouteBuilderMobile>
)

describe('RouteBuilderMobile: подъём страницы к карте по `[⌖]`', () => {
  beforeEach(() => {
    mockScrollPageTo.mockClear()
  })

  it('скроллит на каждый рост счётчика, но не на первом монтаже', () => {
    const { rerender } = render(renderMobile(0))
    expect(mockScrollPageTo).not.toHaveBeenCalled()

    rerender(renderMobile(1))
    expect(mockScrollPageTo).toHaveBeenCalledTimes(1)

    rerender(renderMobile(2))
    expect(mockScrollPageTo).toHaveBeenCalledTimes(2)
  })

  it('повторный монтаж раскладки с прежним счётчиком страницу не двигает', () => {
    const { rerender } = render(renderMobile(3, 'mobile-a'))
    rerender(renderMobile(3, 'mobile-b'))

    expect(mockScrollPageTo).not.toHaveBeenCalled()
  })
})
