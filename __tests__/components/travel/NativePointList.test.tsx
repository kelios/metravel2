import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import { NativePointList } from '@/components/travel/stepRoute/NativePointList'
import type { MarkerData } from '@/types/types'

const MARKERS = [
  { id: 1, lat: 53.9, lng: 27.5667, address: 'Минск', categories: [], image: null },
  { id: 2, lat: 53.68, lng: 23.83, address: 'Гродно', categories: [], image: null },
] as unknown as MarkerData[]

describe('NativePointList', () => {
  // #1722 — тестировщица не нашла способа добавить точку в путешествии, где
  // точки УЖЕ есть: список умел только править, двигать и удалять. Кнопка над
  // картой к этому моменту уже уехала вверх за край экрана, поэтому действие
  // нужно и здесь.
  it('offers adding a point when the route already has some', () => {
    const onAddPoint = jest.fn()
    const screen = render(
      <NativePointList
        markers={MARKERS}
        onChange={jest.fn()}
        onRequestEdit={jest.fn()}
        onAddPoint={onAddPoint}
      />,
    )

    fireEvent.press(screen.getByTestId('travel-wizard.step-route.point-list-add'))

    expect(onAddPoint).toHaveBeenCalledTimes(1)
  })

  it('keeps the header clean when no add handler is wired', () => {
    const screen = render(
      <NativePointList markers={MARKERS} onChange={jest.fn()} onRequestEdit={jest.fn()} />,
    )

    expect(screen.queryByTestId('travel-wizard.step-route.point-list-add')).toBeNull()
  })
})
