// components/trips/planning/useTripRouteExportTrip.ts
// Поездка с разрешённой геометрией маршрута — вход для GPX/KML и печати. Общий для
// вкладки «Экспорт» (TripRouteExportMenu) и пункта «Распечатать план» в «⋯» экрана
// поездки (#2101): геометрию разрешает ровно один путь.
import { useMemo } from 'react'

import type { PlannedTrip } from '@/api/plannedTrips'
import { useTripRouteElevation } from '@/hooks/usePlannedTripsApi'
import { isRouteApproximate } from './tripPlanFormatting'
import {
  hasUsableRouteGeometry,
  isRoutableTransport,
  routablePreviewPoints,
} from './tripRoutePreview'
import { useTripRouteDisplay } from './useTripRouteDisplay'

export function useTripRouteExportTrip(trip: PlannedTrip, options: { enabled?: boolean } = {}) {
  const enabled = options.enabled ?? true
  const shouldResolveSavedGeometry =
    enabled &&
    Boolean(trip.routingState) &&
    !isRouteApproximate(trip.routingState) &&
    isRoutableTransport(trip.transport) &&
    !hasUsableRouteGeometry(trip.routeGeometry) &&
    routablePreviewPoints(trip.route).length >= 2
  const routeElevationQuery = useTripRouteElevation(trip.id, {
    // Export needs this endpoint only as the second persisted geometry source.
    // A normal trip with routeGeometry must not gain an extra request merely
    // because the user opened the Export tab.
    enabled: shouldResolveSavedGeometry,
  })
  const routeDisplay = useTripRouteDisplay({
    trip,
    route: trip.route,
    // Disabled queries may still expose cache from an earlier observer/account.
    // It is not a geometry source unless this exact trip tuple requested it.
    routeElevation: shouldResolveSavedGeometry ? routeElevationQuery.data ?? null : null,
    routeElevationPending: shouldResolveSavedGeometry && routeElevationQuery.isFetching,
    routeShapeMatchesSaved: true,
  })
  const displayTrip = useMemo(
    () => ({
      ...trip,
      routeGeometry: routeDisplay.geometry,
      routingState: routeDisplay.routingState,
      routeSummary: routeDisplay.summary,
    }),
    [routeDisplay.geometry, routeDisplay.routingState, routeDisplay.summary, trip],
  )
  return { routeDisplay, displayTrip }
}
