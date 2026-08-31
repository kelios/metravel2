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
import {
  isRouteApproximate,
  routingStateClaimsNotEnoughPoints,
} from './tripPlanFormatting'
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
  repairingSavedRoute: boolean
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
  const routablePointCount = routablePreviewPoints(route).length
  const savedStateContradictsPointCount =
    routeShapeMatchesSaved &&
    isRoutableTransport(trip.transport) &&
    routablePointCount >= 2 &&
    routingStateClaimsNotEnoughPoints(trip.routingState)
  const savedRouteNeedsRepair =
    routeShapeMatchesSaved &&
    isRoutableTransport(trip.transport) &&
    routablePointCount >= 2 &&
    (
      savedStateContradictsPointCount ||
      (savedStateClaimsHealthy && !hasUsableSavedGeometry)
    )
  // Only the healthy/missing-geometry branch may be repaired by the elevation
  // endpoint. A contradictory point-count state is invalid regardless of that
  // request, so route preview must take ownership immediately.
  const waitingForPersistedGeometry =
    savedRouteNeedsRepair &&
    !savedStateContradictsPointCount &&
    routeElevationPending
  const repairingSavedRoute = savedRouteNeedsRepair && !waitingForPersistedGeometry
  // Hide the inconsistent saved tuple while its second persisted geometry
  // source is still loading, but do not start a duplicate routing request yet.
  const previewOwnsDisplay = !routeShapeMatchesSaved || savedRouteNeedsRepair

  const preview = useTripRoutePreview({
    route,
    transport: trip.transport,
    enabled: !routeShapeMatchesSaved || repairingSavedRoute,
  })

  return useMemo(
    () =>
      previewOwnsDisplay
        ? {
            geometry: preview.geometry,
            routingState: preview.routingState,
            summary: preview.summary,
            elevation: preview.elevation,
            repairingSavedRoute,
            hasUsableSavedGeometry,
            preview,
          }
        : {
            geometry: savedGeometry,
            routingState: trip.routingState,
            summary: trip.routeSummary,
            elevation: routeElevationPending ? null : routeElevation?.preview ?? null,
            repairingSavedRoute,
            hasUsableSavedGeometry,
            preview,
          },
    [
      hasUsableSavedGeometry,
      preview,
      previewOwnsDisplay,
      repairingSavedRoute,
      routeElevation?.preview,
      routeElevationPending,
      savedGeometry,
      trip.routeSummary,
      trip.routingState,
    ],
  )
}
