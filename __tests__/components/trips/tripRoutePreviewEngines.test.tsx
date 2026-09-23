// #2056: превью маршрута с переездом строит каждый прогон своим движком —
// две пешие части и перелёт между ними дают ровно два запроса маршрутизации,
// а итог складывает прогоны и держит переезды отдельно.
import React from 'react'
import { Text } from 'react-native'
import { act, render } from '@testing-library/react-native'

import type { RoutePoint, RoutePointArrivalMode } from '@/api/plannedTrips'
import type { UseMapRoutingResult } from '@/components/map-core/useMapRouting'
import TripRoutePreviewEngines from '@/components/trips/planning/TripRoutePreviewEngines'
import { useTripRoutePreview } from '@/components/trips/planning/useTripRoutePreview'

const mockEngines: Array<{
  points: Array<[number, number]>
  transportMode: string
  onResult: (result: UseMapRoutingResult) => void
}> = []

// Один монтаж движка = один запрос `POST /api/routing/route/` (useMapRouting).
jest.mock('@/components/trips/planning/TripRoutePreviewEngine', () => {
  const mockReact = jest.requireActual('react')
  return function TripRoutePreviewEngine(props: {
    points: Array<[number, number]>
    transportMode: string
    onResult: (result: unknown) => void
  }) {
    mockReact.useEffect(() => {
      mockEngines.push({
        points: props.points,
        transportMode: props.transportMode,
        onResult: props.onResult as never,
      })
      // Монтаж, а не каждый рендер: так движок и живёт.
    }, [])
    return null
  }
})

const pt = (
  id: string,
  coordinates: [number, number],
  arrivalMode: RoutePointArrivalMode | null = null,
): RoutePoint => ({ id, type: 'custom', name: id, description: null, coordinates, placeId: null, arrivalMode })

const answer = (distance: number, duration: number, coords: Array<[number, number]>): UseMapRoutingResult => ({
  loading: false,
  error: null,
  distance,
  duration,
  coords,
  elevationGain: 50,
  elevationLoss: 40,
  elevationSamples: null,
})

function Harness({ route }: { route: RoutePoint[] }) {
  const preview = useTripRoutePreview({ route, transport: 'foot', enabled: true })
  return (
    <>
      <TripRoutePreviewEngines preview={preview} />
      <Text testID="preview-summary">{JSON.stringify(preview.summary)}</Text>
      <Text testID="preview-loading">{String(preview.loading)}</Text>
    </>
  )
}

describe('TripRoutePreviewEngines (#2056)', () => {
  beforeEach(() => {
    mockEngines.length = 0
  })

  it('two walking parts and a flight → two routing requests, none across the flight', () => {
    const route = [pt('a', [0, 0]), pt('b', [1, 0]), pt('c', [5, 0], 'flight'), pt('d', [6, 0])]
    const { getByTestId } = render(<Harness route={route} />)

    expect(mockEngines.map((engine) => engine.points)).toEqual([
      [[0, 0], [1, 0]],
      [[5, 0], [6, 0]],
    ])
    expect(mockEngines.every((engine) => engine.transportMode === 'foot')).toBe(true)
    expect(getByTestId('preview-loading').props.children).toBe('true')

    act(() => mockEngines[0].onResult(answer(12_000, 10_800, [[0, 0], [0.5, 0.1], [1, 0]])))
    // Один прогон ответил — итог ещё не собран.
    expect(getByTestId('preview-loading').props.children).toBe('true')
    act(() => mockEngines[1].onResult(answer(3_000, 2_700, [[5, 0], [6, 0]])))

    expect(getByTestId('preview-loading').props.children).toBe('false')
    const summary = JSON.parse(String(getByTestId('preview-summary').props.children))
    expect(summary.distanceKm).toBe(15)
    expect(summary.durationMin).toBe(225)
    expect(summary.transferDistanceKm).toBeGreaterThan(440)
    expect(summary.legs.map((leg: { mode: string }) => leg.mode)).toEqual(['route', 'flight', 'route'])
  })

  it('a trip without transfers mounts one engine with every point, as before', () => {
    const route = [pt('a', [0, 0]), pt('b', [1, 0]), pt('c', [5, 0])]
    render(<Harness route={route} />)
    expect(mockEngines).toHaveLength(1)
    expect(mockEngines[0].points).toEqual([[0, 0], [1, 0], [5, 0]])
  })
})
