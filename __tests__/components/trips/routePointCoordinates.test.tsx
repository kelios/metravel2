// #1671: координаты точки маршрута в карточке плана поездки.
// Формат ВВОДА (шесть знаков) раньше переиспользовался для ОТОБРАЖЕНИЯ, и
// строка из 21 символа переносилась в узкой колонке по цифрам на четыре
// строки. Тест держит оба свойства: пять знаков и одна строка.
import React from 'react'
import { render } from '@testing-library/react-native'

import RoutePointRow from '@/components/trips/planning/RoutePointRow'
import { createStyles } from '@/components/trips/planning/RouteBuilder.styles'
import { formatRoutePointCoordinates } from '@/components/trips/planning/tripPlanFormatting'
import type { ThemedColors } from '@/hooks/useTheme'

const colors = new Proxy({}, { get: (_target, key) => String(key) }) as ThemedColors

const renderRow = (coordinates: [number, number] | null) =>
  render(
    <RoutePointRow
      point={{
        id: 'a',
        type: 'place',
        name: 'Точка',
        description: null,
        coordinates,
        placeId: null,
      }}
      index={0}
      total={1}
      isOwner
      styles={createStyles(colors)}
      colors={colors}
      dragHandlers={null}
      isDragging={false}
      isDropTarget={false}
      dragOffsetY={0}
      onLayout={jest.fn()}
      onEdit={jest.fn()}
      onMove={jest.fn()}
      onDelete={jest.fn()}
    />,
  )

describe('route point coordinates display format', () => {
  it('formats a display pair with five decimals in lat, lng order', () => {
    expect(formatRoutePointCoordinates([26.247111, 56.006732])).toBe(
      '56.00673, 26.24711',
    )
  })

  it('returns null for a missing or broken pair instead of printing NaN', () => {
    expect(formatRoutePointCoordinates(null)).toBeNull()
    expect(formatRoutePointCoordinates(undefined)).toBeNull()
    expect(formatRoutePointCoordinates([Number.NaN, 56.006732])).toBeNull()
  })

  it('keeps the row coordinates on a single truncated line', () => {
    const { getByText } = renderRow([26.247111, 56.006732])
    const coordinates = getByText('56.00673, 26.24711')

    expect(coordinates.props.numberOfLines).toBe(1)
    expect(coordinates.props.ellipsizeMode).toBe('tail')
  })

  it('renders no coordinates line for a point without a pair', () => {
    const { queryByText } = renderRow(null)
    expect(queryByText(/\d+\.\d+, /)).toBeNull()
  })
})
