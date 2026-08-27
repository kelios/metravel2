import { useMemo } from 'react'

import type {
  PlannedTrip,
  RouteGeometry,
  RoutePoint,
  RouteSummary,
  RoutingState,
  TripRouteElevation,
} from '@/api/plannedTrips'
import type { ParsedRoutePreview } from '@/types/travelRoutes'
import { isRouteApproximate } from './tripPlanFormatting'
import {
  hasUsableRouteGeometry,
  isRoutableTransport,
  routablePreviewPoints,
} from './tripRoutePreview'
import {
  useTripRoutePreview,
  type TripRoutePreviewState,
} from './useTripRoutePreview'

export interface TripRouteDisplayState {
  geometry: RouteGeometry | null
  routingState: RoutingState | null
  summary: RouteSummary | null
  elevation: ParsedRoutePreview | null
  repairingSavedGeometry: boolean
  hasUsableSavedGeometry: boolean
  preview: TripRoutePreviewState
}

interface Options {
  trip: PlannedTrip
  route: RoutePoint[]
  routeElevation: TripRouteElevation | null
  /** The elevation endpoint may still provide the missing saved geometry. */
  routeElevationPending: boolean
  routeShapeMatchesSaved: boolean
}

const savedGeometryFor = (
  tripGeometry: RouteGeometry | null,
  elevationGeometry: RouteGeometry | null,
): RouteGeometry | null => {
  if (hasUsableRouteGeometry(tripGeometry)) return tripGeometry
  if (hasUsableRouteGeometry(elevationGeometry)) return elevationGeometry
  return null
}

/**
 * Owns the complete geometry/state/summary tuple displayed by the planner.
 * A persisted healthy routing state is not allowed to survive independently
 * when neither saved endpoint provides usable geometry (#873).
 */
export function useTripRouteDisplay({
  trip,
  route,
  routeElevation,
  routeElevationPending,
  routeShapeMatchesSaved,
}: Options): TripRouteDisplayState {
  const savedGeometry = useMemo(
    () => savedGeometryFor(
      trip.routeGeometry,
      routeElevationPending ? null : routeElevation?.geometry ?? null,
    ),
    [routeElevation?.geometry, routeElevationPending, trip.routeGeometry],
  )
  const hasUsableSavedGeometry = savedGeometry !== null
  const savedStateClaimsHealthy = Boolean(
    trip.routingState && !isRouteApproximate(trip.routingState),
  )
  const savedRouteNeedsGeometry =
    routeShapeMatchesSaved &&
    isRoutableTransport(trip.transport) &&
    routablePreviewPoints(route).length >= 2 &&
    savedStateClaimsHealthy &&
    !hasUsableSavedGeometry
  const repairingSavedGeometry = savedRouteNeedsGeometry && !routeElevationPending
  // Hide the inconsistent saved tuple while its second persisted geometry
  // source is still loading, but do not start a duplicate routing request yet.
  const previewOwnsDisplay = !routeShapeMatchesSaved || savedRouteNeedsGeometry

  const preview = useTripRoutePreview({
    route,
    transport: trip.transport,
    enabled: !routeShapeMatchesSaved || repairingSavedGeometry,
  })

  return useMemo(
    () =>
      previewOwnsDisplay
        ? {
            geometry: preview.geometry,
            routingState: preview.routingState,
            summary: preview.summary,
            elevation: preview.elevation,
            repairingSavedGeometry,
            hasUsableSavedGeometry,
            preview,
          }
        : {
            geometry: savedGeometry,
            routingState: trip.routingState,
            summary: trip.routeSummary,
            elevation: routeElevationPending ? null : routeElevation?.preview ?? null,
            repairingSavedGeometry,
            hasUsableSavedGeometry,
            preview,
          },
    [
      hasUsableSavedGeometry,
      preview,
      previewOwnsDisplay,
      repairingSavedGeometry,
      routeElevation?.preview,
      routeElevationPending,
      savedGeometry,
      trip.routeSummary,
      trip.routingState,
    ],
  )
}
