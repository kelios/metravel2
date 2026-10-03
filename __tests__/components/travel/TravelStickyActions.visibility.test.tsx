import React from 'react'
import { act, render, screen } from '@testing-library/react-native'
import { Animated } from 'react-native'

import TravelStickyActions from '@/components/travel/details/TravelStickyActions'
import { translate } from '@/i18n'
import type { Travel } from '@/types/types'

jest.mock('@/hooks/useFavoriteToggle', () => ({
  useFavoriteToggle: () => ({ toggle: jest.fn(), isFavorite: () => false }),
}))

type SpringCallback = (result: { finished: boolean }) => void

const TOOLBAR_LABEL = translate(
  'travel:components.travel.details.TravelStickyActions.deystviya_s_puteshestviem_22b82c23',
)

describe('TravelStickyActions visibility (#2117)', () => {
  let springCallbacks: (SpringCallback | undefined)[]

  beforeEach(() => {
    springCallbacks = []
    jest.spyOn(Animated, 'spring').mockImplementation(
      () =>
        ({
          start: (cb?: SpringCallback) => {
            springCallbacks.push(cb)
          },
        }) as unknown as Animated.CompositeAnimation,
    )
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  const renderBar = () => {
    const scrollY = new Animated.Value(0)
    render(
      <TravelStickyActions
        travel={{ id: 1, name: 'Travel', slug: 'travel' } as Travel}
        scrollY={scrollY}
        scrollToComments={jest.fn()}
      />,
    )
    const scrollTo = (value: number) => act(() => scrollY.setValue(value))
    return { scrollTo }
  }

  it('unmounts after a completed hide even when an earlier hide was interrupted by a show', () => {
    const { scrollTo } = renderBar()

    scrollTo(1000)
    scrollTo(900) // up past the threshold → show
    expect(screen.queryByLabelText(TOOLBAR_LABEL)).not.toBeNull()

    scrollTo(1000) // down → hide spring A
    const interruptedHide = springCallbacks.at(-1)
    scrollTo(900) // up → show spring B interrupts A
    act(() => interruptedHide?.({ finished: false }))
    expect(screen.queryByLabelText(TOOLBAR_LABEL)).not.toBeNull()

    scrollTo(1000) // down → hide spring C runs to the end
    const completedHide = springCallbacks.at(-1)
    act(() => completedHide?.({ finished: true }))
    expect(screen.queryByLabelText(TOOLBAR_LABEL)).toBeNull()
  })

  it('shows on a slow upward drag made of per-frame steps below 5 px (#2118)', () => {
    const { scrollTo } = renderBar()

    scrollTo(2000)
    for (let y = 1997; y >= 1985; y -= 3) scrollTo(y) // 3 px per frame, 15 px in total
    expect(screen.queryByLabelText(TOOLBAR_LABEL)).not.toBeNull()
  })

  it('ignores upward jitter below the direction slop', () => {
    const { scrollTo } = renderBar()

    scrollTo(2000)
    scrollTo(1996)
    scrollTo(1999)
    scrollTo(1992) // 8 px below the peak
    expect(screen.queryByLabelText(TOOLBAR_LABEL)).toBeNull()
  })
})
