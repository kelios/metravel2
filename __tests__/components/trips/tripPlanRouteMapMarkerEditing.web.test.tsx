/**
 * #1781 — маркер точки маршрута на web-карте планировщика.
 *
 * Regression control карточки на стороне карты: маркер владельца перетаскивается
 * и отдаёт координаты дропа, popup несёт удаление рядом с редактированием, а у
 * гостя ни того, ни другого нет. Плюс инвариант кадра: ручное перемещение
 * выключает авто-подгонку, иначе карта отменяла бы наведённую точность.
 */
import React from 'react'
import { render, waitFor } from '@testing-library/react-native'

import type { RoutePoint } from '@/api/plannedTrips'

const markerProps: Array<Record<string, unknown>> = []
const mockFitBounds = jest.fn()
const mockSetView = jest.fn()
const mockMap = { setView: mockSetView, fitBounds: mockFitBounds, stop: jest.fn() }

jest.mock('react-dom', () => ({ createPortal: (node: unknown) => node }))
jest.mock('@/utils/ensureLeafletCss', () => ({ ensureLeafletCss: jest.fn() }))

jest.mock('@/utils/loadLeafletRuntime', () => ({
  loadLeafletRuntime: async () => ({
    L: {
      divIcon: (options: unknown) => options,
      latLngBounds: (positions: unknown) => positions,
    },
    RL: {
      Marker: (props: Record<string, unknown>) => {
        markerProps.push(props)
        return <>{props.children as React.ReactNode}</>
      },
      Popup: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
      Polyline: () => null,
      useMap: () => mockMap,
      useMapEvents: () => null,
    },
  }),
}))

jest.mock('@/components/MapPage/Map/MapCanvas', () => ({
  MapCanvas: ({ children }: { children?: (engine: unknown) => React.ReactNode }) => (
    <div data-testid="map-canvas">{children?.({})}</div>
  ),
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () =>
    new Proxy({}, { get: (_t, key) => String(key) }) as unknown as Record<string, string>,
}))

import TripPlanRouteMap from '@/components/trips/planning/TripPlanRouteMap.web'

const route: RoutePoint[] = [
  { id: 'a', type: 'custom', name: 'Старт', description: null, coordinates: [27.56, 53.9], placeId: null },
  { id: 'b', type: 'custom', name: 'Финиш', description: null, coordinates: [27.6, 53.91], placeId: null },
]

const dragEndAt = (index: number, lat: number, lng: number) => {
  const handlers = markerProps[index].eventHandlers as { dragend: (event: unknown) => void }
  handlers.dragend({ target: { getLatLng: () => ({ lat, lng }) } })
}

describe('#1781 TripPlanRouteMap.web — правка точки с карты', () => {
  beforeEach(() => {
    markerProps.length = 0
    mockFitBounds.mockClear()
    mockSetView.mockClear()
  })

  it('отдаёт индекс и координаты дропа после перетаскивания маркера', async () => {
    const onMovePoint = jest.fn()
    render(<TripPlanRouteMap route={route} onMovePoint={onMovePoint} />)

    await waitFor(() => expect(markerProps).toHaveLength(2))
    expect(markerProps[1].draggable).toBe(true)

    dragEndAt(1, 53.915, 27.61)

    expect(onMovePoint).toHaveBeenCalledWith({ index: 1, lat: 53.915, lng: 27.61 })
  })

  it('не отдаёт наружу нефинитную позицию дропа', async () => {
    const onMovePoint = jest.fn()
    render(<TripPlanRouteMap route={route} onMovePoint={onMovePoint} />)

    await waitFor(() => expect(markerProps).toHaveLength(2))
    dragEndAt(0, Number.NaN, 27.6)

    expect(onMovePoint).not.toHaveBeenCalled()
  })

  it('после ручного перемещения не подгоняет кадр под изменившийся маршрут', async () => {
    const { rerender } = render(<TripPlanRouteMap route={route} onMovePoint={jest.fn()} />)

    await waitFor(() => expect(markerProps).toHaveLength(2))
    // Первая подгонка — штатная, кадр ещё принадлежит данным.
    expect(mockFitBounds).toHaveBeenCalledTimes(1)

    dragEndAt(1, 53.95, 27.7)
    const movedRoute: RoutePoint[] = [
      route[0],
      { ...route[1], coordinates: [27.7, 53.95] },
    ]
    rerender(<TripPlanRouteMap route={movedRoute} onMovePoint={jest.fn()} />)

    expect(mockFitBounds).toHaveBeenCalledTimes(1)
  })

  it('снова подгоняет кадр, когда маршрут заменён целиком', async () => {
    const { rerender } = render(<TripPlanRouteMap route={route} onMovePoint={jest.fn()} />)

    await waitFor(() => expect(markerProps).toHaveLength(2))
    expect(mockFitBounds).toHaveBeenCalledTimes(1)

    dragEndAt(1, 53.95, 27.7)
    const movedRoute: RoutePoint[] = [
      route[0],
      { ...route[1], coordinates: [27.7, 53.95] },
    ]
    rerender(<TripPlanRouteMap route={movedRoute} onMovePoint={jest.fn()} />)
    expect(mockFitBounds).toHaveBeenCalledTimes(1)

    // Шаблон или импортированный трек не оставляет ни одной прежней точки:
    // иначе новый маршрут навсегда остался бы за пределами кадра.
    const importedRoute: RoutePoint[] = [
      { id: 'i1', type: 'custom', name: 'Прага', description: null, coordinates: [14.43, 50.07], placeId: null },
      { id: 'i2', type: 'custom', name: 'Брно', description: null, coordinates: [16.6, 49.19], placeId: null },
    ]
    rerender(<TripPlanRouteMap route={importedRoute} onMovePoint={jest.fn()} />)

    expect(mockFitBounds).toHaveBeenCalledTimes(2)
  })

  it('не снимает защёлку кадра, когда перетащили единственную точку маршрута', async () => {
    const single: RoutePoint[] = [route[0]]
    const { rerender } = render(<TripPlanRouteMap route={single} onMovePoint={jest.fn()} />)

    await waitFor(() => expect(markerProps).toHaveLength(1))
    expect(mockSetView).toHaveBeenCalledTimes(1)

    // Leaflet отдаёт сырую позицию дропа, а `RouteBuilder` кладёт в маршрут
    // округлённую до шести знаков: координатный ключ защёлки не совпал бы.
    dragEndAt(0, 53.90123456789012, 27.56789123456789)
    rerender(
      <TripPlanRouteMap
        route={[{ ...single[0], coordinates: [27.567891, 53.901235] }]}
        onMovePoint={jest.fn()}
      />,
    )

    expect(mockSetView).toHaveBeenCalledTimes(1)
  })

  it('даёт владельцу удалить точку из popup её маркера, не теряя редактирование', async () => {
    const onDeletePoint = jest.fn()
    const screen = render(
      <TripPlanRouteMap route={route} onMovePoint={jest.fn()} onDeletePoint={onDeletePoint} />,
    )

    await waitFor(() => expect(markerProps).toHaveLength(2))
    // Удаление стоит РЯДОМ с существующим редактированием, а не вместо него.
    expect(screen.UNSAFE_getAllByProps({ 'data-testid': 'trip-plan-map-edit-point-1' })).not.toHaveLength(0)

    const [deleteButton] = screen.UNSAFE_getAllByProps({
      'data-testid': 'trip-plan-map-delete-point-1',
    })
    ;(deleteButton.props.onClick as () => void)()

    expect(onDeletePoint).toHaveBeenCalledWith(1)
  })

  it('гостю не даёт ни тянуть маркер, ни удалять точку', async () => {
    const screen = render(
      <TripPlanRouteMap route={route} readonly onMovePoint={jest.fn()} onDeletePoint={jest.fn()} />,
    )

    await waitFor(() => expect(markerProps).toHaveLength(2))
    expect(markerProps[0].draggable).toBe(false)
    expect(markerProps[0].eventHandlers).toBeUndefined()
    expect(screen.UNSAFE_queryAllByProps({ 'data-testid': 'trip-plan-map-delete-point-0' })).toHaveLength(0)
    expect(screen.UNSAFE_queryAllByProps({ 'data-testid': 'trip-plan-map-edit-point-0' })).toHaveLength(0)
    expect(screen.queryByTestId('trip-plan-map-marker-hint')).toBeNull()
  })

  it('показывает владельцу подсказку про жест над маркером', async () => {
    const screen = render(<TripPlanRouteMap route={route} onMovePoint={jest.fn()} />)

    expect(await screen.findByTestId('trip-plan-map-marker-hint')).toBeTruthy()
  })
})
