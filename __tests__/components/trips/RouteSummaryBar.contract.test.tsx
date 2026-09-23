import React from 'react'
import { StyleSheet } from 'react-native'
import { render, within } from '@testing-library/react-native'

import type { RouteSummary, RoutingState } from '@/api/plannedTrips'
import RouteSummaryBar from '@/components/trips/planning/RouteSummaryBar'

const summary: RouteSummary = {
  distanceKm: 16.5,
  durationMin: 42,
  elevationGainM: 452,
  stopsCount: 7,
  provider: 'ors',
}

const routed: RoutingState = {
  provider: 'ors',
  isOptimal: true,
  fallbackReason: null,
  warnings: [],
}

describe('RouteSummaryBar layout contract', () => {
  it('separates route status and transport metadata from exactly four metrics', () => {
    const { getByTestId } = render(
      <RouteSummaryBar summary={summary} routingState={routed} transport="bike" />,
    )

    const root = getByTestId('route-summary')
    const metrics = within(root).getByTestId('route-summary-metrics')
    const status = within(root).getByTestId('route-summary-status')

    expect(status).toContainElement(within(root).getByTestId('route-summary-routed'))
    expect(within(root).getByTestId('route-summary-transport')).toBeTruthy()
    expect(within(metrics).queryByTestId('route-summary-status')).toBeNull()
    expect(within(metrics).queryByTestId('route-summary-transport')).toBeNull()
    expect(
      within(metrics).getAllByTestId(
        /^route-summary-metric-(distance|duration|elevation|stops)$/,
      ),
    ).toHaveLength(4)
    expect(within(metrics).getByTestId('route-summary-metric-distance')).toBeTruthy()
    expect(within(metrics).getByTestId('route-summary-metric-duration')).toBeTruthy()
    expect(within(metrics).getByTestId('route-summary-metric-elevation')).toBeTruthy()
    expect(within(metrics).getByTestId('route-summary-metric-stops')).toBeTruthy()

    expect(StyleSheet.flatten(metrics.props.style)).toMatchObject({
      flexDirection: 'row',
      flexWrap: 'wrap',
    })
    for (const metric of within(metrics).getAllByTestId(/^route-summary-metric-(distance|duration|elevation|stops)$/)) {
      expect(StyleSheet.flatten(metric.props.style)).toMatchObject({
        minWidth: 0,
        flexBasis: '48%',
      })
    }
    for (const id of ['distance', 'duration', 'elevation', 'stops']) {
      expect(within(metrics).getByTestId(`route-summary-metric-${id}-value`)).toHaveProp(
        'numberOfLines',
        1,
      )
      expect(within(metrics).getByTestId(`route-summary-metric-${id}-label`)).toHaveProp(
        'numberOfLines',
        1,
      )
    }
  })

  it('keeps degraded routing state in the dedicated status slot', () => {
    const { getByTestId, queryByTestId } = render(
      <RouteSummaryBar
        summary={{ ...summary, provider: 'direct' }}
        routingState={{
          provider: 'direct',
          isOptimal: false,
          fallbackReason: 'routing_failed',
          warnings: ['routing_failed'],
        }}
        transport="foot"
      />,
    )

    expect(getByTestId('route-summary-status')).toContainElement(
      getByTestId('route-summary-approximate'),
    )
    expect(queryByTestId('route-summary-routed')).toBeNull()
  })

  // #2057: прод trip 47 — «В пути 481 ч 57 мин» (дистанция по прямой / 1,4 м/с),
  // пустая плитка «Набор —» и причина ещё раз под чипом, хотя её уже показала карта.
  it('shows a direct line as a straight-line distance with stops, without time, elevation or reason', () => {
    const { getByTestId, queryByTestId, queryByText } = render(
      <RouteSummaryBar
        summary={{
          distanceKm: 2429,
          durationMin: 28917,
          elevationGainM: 0,
          stopsCount: 61,
          provider: 'direct',
        }}
        routingState={{
          provider: 'direct',
          isOptimal: false,
          fallbackReason: 'ors_http_404',
          warnings: ['ors_http_404'],
        }}
        transport="foot"
      />,
    )

    const metrics = getByTestId('route-summary-metrics')
    expect(
      within(metrics).getAllByTestId(/^route-summary-metric-(distance|duration|elevation|stops)$/),
    ).toHaveLength(2)
    expect(queryByTestId('route-summary-metric-duration')).toBeNull()
    expect(queryByTestId('route-summary-metric-elevation')).toBeNull()
    expect(getByTestId('route-summary-metric-distance-value')).toHaveTextContent('≈ 2 429 км')
    expect(getByTestId('route-summary-metric-distance-label')).toHaveTextContent('Дистанция по прямой')
    // Длинная подпись переносится на вторую строку, а не режется многоточием.
    expect(getByTestId('route-summary-metric-distance-label')).toHaveProp('numberOfLines', 2)
    expect(getByTestId('route-summary-metric-stops-value')).toHaveTextContent('61')
    expect(queryByText(/\d\s*(ч|мин)(?![а-яё])/)).toBeNull()

    // Причину показывает карта; здесь остаётся только чип.
    expect(
      within(getByTestId('route-summary-approximate')).getByText('Приблизительный маршрут'),
    ).toBeTruthy()
    expect(queryByText(/Не получилось проложить|временно недоступен/)).toBeNull()
  })

  it('keeps the four metrics and the empty elevation tile for a routed summary (#1336)', () => {
    const { getByTestId } = render(
      <RouteSummaryBar summary={{ ...summary, elevationGainM: 0 }} routingState={routed} transport="car" />,
    )

    expect(
      within(getByTestId('route-summary-metrics')).getAllByTestId(
        /^route-summary-metric-(distance|duration|elevation|stops)$/,
      ),
    ).toHaveLength(4)
    expect(getByTestId('route-summary-metric-elevation-value')).toHaveTextContent('—')
    expect(getByTestId('route-summary-metric-duration-value')).toHaveTextContent('42 мин')
  })
})
