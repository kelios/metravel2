// #2056: переезды в UI планировщика — поле «Как добираюсь сюда» (не у первой
// точки), плашка «Перелёт · 431 км» в списке, «Переезды K км» в итоге и
// несохранённая правка способа в подписи маршрута.
import React from 'react'
import { Text } from 'react-native'
import { fireEvent, render, within } from '@testing-library/react-native'

import type { RoutePoint, RoutePointArrivalMode, RouteSummary } from '@/api/plannedTrips'
import RoutePointEditForm from '@/components/trips/planning/RoutePointEditForm'
import { RouteDayGroups } from '@/components/trips/planning/RouteDayGroupHeader'
import RouteSummaryBar from '@/components/trips/planning/RouteSummaryBar'
import { createStyles } from '@/components/trips/planning/RouteBuilder.styles'
import { routeSignature } from '@/components/trips/planning/routeBuilderPoint'
import { EMPTY_OVERNIGHT_BOOKING_DRAFT } from '@/components/trips/planning/routeOvernightBooking'
import { routeMetricsLine, routeSummaryLine } from '@/components/trips/planning/tripPlanFormatting'
import type { ThemedColors } from '@/hooks/useTheme'

jest.mock('@/components/trips/planning/scrollPlannerNodeIntoView', () => ({
  scrollPlannerNodeIntoView: jest.fn(),
}))

jest.mock('@/components/MapPage/AddressSearch', () => {
  return function AddressSearch() {
    return null
  }
})

const colors = new Proxy({}, { get: (_target, key) => String(key) }) as ThemedColors
const styles = createStyles(colors)

const point = (
  id: string,
  coordinates: [number, number] | null,
  arrivalMode: RoutePointArrivalMode | null = null,
): RoutePoint => ({ id, type: 'custom', name: id, description: null, coordinates, placeId: null, arrivalMode })

const MUC: [number, number] = [11.786, 48.3538]
const LUX: [number, number] = [6.2044, 49.6233]
const ECHTERNACH: [number, number] = [6.4214, 49.8117]

const renderForm = (editingIndex: number, onChange = jest.fn()) =>
  render(
    <RoutePointEditForm
      styles={styles}
      colors={colors}
      isMapFirst={false}
      editingIndex={editingIndex}
      routeLength={3}
      typeOptions={['custom']}
      type="custom"
      name="Точка"
      lat="49.6"
      lng="6.2"
      description=""
      booking={EMPTY_OVERNIGHT_BOOKING_DRAFT}
      dayNumber=""
      arrival={{ value: null, onChange }}
      dayChips={[]}
      error={null}
      onTypeChange={jest.fn()}
      onBookingChange={jest.fn()}
      onDayNumberChange={jest.fn()}
      onAddressSelect={jest.fn()}
      onNameChange={jest.fn()}
      onLatChange={jest.fn()}
      onLngChange={jest.fn()}
      onDescriptionChange={jest.fn()}
      onSave={jest.fn()}
      onCancel={jest.fn()}
      onMove={jest.fn()}
      onDelete={jest.fn()}
    />,
  )

describe('«Как добираюсь сюда» in the point form', () => {
  it('is not offered on the first point', () => {
    const { queryByTestId } = renderForm(0)
    expect(queryByTestId('route-builder-arrival-field')).toBeNull()
  })

  it('offers inherit plus five modes on a later point and reports the choice', () => {
    const onChange = jest.fn()
    const { getByTestId, getByText } = renderForm(2, onChange)
    const field = getByTestId('route-builder-arrival-field')
    expect(within(field).getByText('Как добираюсь сюда')).toBeTruthy()
    for (const id of ['inherit', 'train', 'flight', 'bus', 'ferry', 'transfer']) {
      expect(getByTestId(`route-builder-arrival-${id}`)).toBeTruthy()
    }
    expect(getByTestId('route-builder-arrival-inherit')).toHaveProp('accessibilityState', { selected: true })
    expect(getByText('Как вся поездка')).toBeTruthy()
    fireEvent.press(getByTestId('route-builder-arrival-flight'))
    expect(onChange).toHaveBeenLastCalledWith('flight')
    fireEvent.press(getByTestId('route-builder-arrival-inherit'))
    expect(onChange).toHaveBeenLastCalledWith(null)
  })
})

describe('routeSignature carries the arrival mode', () => {
  it('changes when a later point switches to a flight', () => {
    const walked = [point('a', MUC), point('b', LUX)]
    const flown = [point('a', MUC), point('b', LUX, 'flight')]
    expect(routeSignature(flown)).not.toBe(routeSignature(walked))
  })

  it('ignores a mode on the first point — the PUT sends it as empty', () => {
    expect(routeSignature([point('a', MUC, 'train'), point('b', LUX)]))
      .toBe(routeSignature([point('a', MUC), point('b', LUX)]))
  })
})

describe('transfer plaque in the point list', () => {
  it('renders «Перелёт · 431 км» right above the point reached by plane', () => {
    const route = [point('a', MUC), point('b', LUX, 'flight'), point('c', ECHTERNACH)]
    const { getByTestId, toJSON } = render(
      <RouteDayGroups
        route={route}
        startDate="2026-09-25"
        styles={styles}
        colors={colors}
        renderPoint={(item) => <Text key={item.id} testID={`row-${item.id}`}>{item.name}</Text>}
      />,
    )
    // Иконка — Feather (в jest-моке печатает своё имя), подпись — отдельный текст.
    expect(within(getByTestId('route-transfer-leg-1')).getByText(/^Перелёт · 431\s?км$/)).toBeTruthy()
    const order = JSON.stringify(toJSON())
    expect(order.indexOf('route-transfer-leg-1')).toBeGreaterThan(order.indexOf('row-a'))
    expect(order.indexOf('route-transfer-leg-1')).toBeLessThan(order.indexOf('row-b'))
  })
})

describe('separate totals', () => {
  const summary: RouteSummary = {
    distanceKm: 189,
    durationMin: 225,
    elevationGainM: 900,
    stopsCount: 12,
    provider: 'ors',
    transferDistanceKm: 2240,
  }

  it('appends «Переезды K км» to the routed metrics, never into them', () => {
    expect(routeMetricsLine(summary)).toMatch(/^189\s?км · 3 ч 45 мин · Переезды 2\s?240\s?км$/)
    expect(routeSummaryLine(summary)).toContain('Переезды 2')
    expect(routeMetricsLine({ ...summary, transferDistanceKm: 0 })).not.toContain('Переезды')
  })

  it('shows only the transfers when nothing is routed', () => {
    expect(routeMetricsLine({ ...summary, distanceKm: 0, provider: 'direct' }))
      .toMatch(/^Переезды 2\s?240\s?км$/)
  })

  it('adds a «Переезды» tile next to an unchanged distance tile', () => {
    const { getByTestId } = render(<RouteSummaryBar summary={summary} transport="foot" />)
    expect(getByTestId('route-summary-metric-distance-value')).toHaveTextContent(/^189\s?км$/)
    expect(getByTestId('route-summary-metric-transfers-value')).toHaveTextContent(/^2\s?240\s?км$/)
    expect(getByTestId('route-summary-metric-transfers-label')).toHaveTextContent('Переезды')
  })
})
