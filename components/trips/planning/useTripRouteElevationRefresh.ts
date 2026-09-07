// components/trips/planning/useTripRouteElevationRefresh.ts
// Высоты маршрута поездки: чтение профиля и единственный пересчёт ORS на
// маршрут. Вынесено из RouteBuilder.tsx (#1825) дословно.
//
// Разделено на два хука не по вкусу, а по данным: `useTripRouteDisplay` считает
// `hasUsableSavedGeometry` из ответа профиля, а эффект пересчёта читает этот же
// флаг. Один вызов замкнул бы данные на себя, поэтому источник профиля
// вызывается ДО `useTripRouteDisplay`, а эффект пересчёта — ПОСЛЕ, ровно там,
// где он и стоял в контейнере.
import { useEffect, useMemo, useRef } from 'react';

import { type PlannedTrip, type RoutePoint } from '@/api/plannedTrips';
import {
  useRefreshTripRouteElevation,
  useTripRouteElevation,
} from '@/hooks/usePlannedTripsApi';

type RouteElevationQuery = ReturnType<typeof useTripRouteElevation>;

export function useTripRouteElevationSource({
  tripId,
  routeShapeMatchesSaved,
  routableSavedPoints,
}: {
  tripId: number;
  routeShapeMatchesSaved: boolean;
  routableSavedPoints: number;
}) {
  // Профиль высот описывает сохранённый маршрут, поэтому пока точки не совпадают
  // с серверными, он скрыт вместе с серверной геометрией.
  const routeElevationQuery = useTripRouteElevation(tripId, {
    enabled: routeShapeMatchesSaved && routableSavedPoints >= 2,
  });

  return {
    routeElevationQuery,
    routeElevation: routeShapeMatchesSaved ? routeElevationQuery.data ?? null : null,
    routeElevationPending: routeShapeMatchesSaved && routeElevationQuery.isFetching,
  };
}

export function useTripRouteElevationRefresh({
  trip,
  route,
  routeElevationQuery,
  routeShapeMatchesSaved,
  hasUsableSavedGeometry,
  savedRouteSignature,
}: {
  trip: PlannedTrip;
  route: RoutePoint[];
  routeElevationQuery: RouteElevationQuery;
  routeShapeMatchesSaved: boolean;
  hasUsableSavedGeometry: boolean;
  savedRouteSignature: string;
}) {
  // Сохранение маршрута кладёт сводку без высот; один пересчёт ORS на маршрут
  // возвращает ascent/descent и 3D-полилинию. Прямую линию не пересчитываем —
  // у провайдера для неё высот нет.
  const refreshRouteElevation = useRefreshTripRouteElevation();
  const refreshRouteElevationMutate = refreshRouteElevation.mutate;
  const elevationRefreshKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      !trip.isOwner ||
      !routeShapeMatchesSaved ||
      routeElevationQuery.isFetching ||
      !hasUsableSavedGeometry
    ) return;
    const elevation = routeElevationQuery.data;
    if (!elevation || elevation.preview || elevation.provider !== 'ors') return;

    // Профиль зависит не только от точек: смена транспорта и типа велосипеда
    // перестраивает маршрут на тех же точках и снова обнуляет высоты, поэтому
    // без них ключ повторно совпал бы и график высот больше не вернулся бы.
    const refreshKey = `${trip.id}:${savedRouteSignature}:${trip.transport}:${trip.bikeType ?? 'none'}`;
    if (elevationRefreshKeyRef.current === refreshKey) return;
    elevationRefreshKeyRef.current = refreshKey;
    refreshRouteElevationMutate({ tripId: trip.id });
  }, [
    refreshRouteElevationMutate,
    routeElevationQuery.data,
    routeElevationQuery.isFetching,
    hasUsableSavedGeometry,
    routeShapeMatchesSaved,
    savedRouteSignature,
    trip.bikeType,
    trip.id,
    trip.isOwner,
    trip.transport,
  ]);

  // Названия точек маршрута подписывают старт/пик/финиш на графике. Берём
  // текущий маршрут, а не сохранённый: график идёт вслед за превью.
  const elevationPlaceHints = useMemo(
    () =>
      route.flatMap((point) =>
        point.coordinates
          ? [{ name: point.name, coord: `${point.coordinates[1]},${point.coordinates[0]}` }]
          : [],
      ),
    [route],
  );

  return elevationPlaceHints;
}
