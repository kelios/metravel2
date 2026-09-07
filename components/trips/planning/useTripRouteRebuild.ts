// components/trips/planning/useTripRouteRebuild.ts
// Транспорт и тип велосипеда конструктора маршрута: две мутации, общий
// синхронный лок и общая ошибка. Вынесено из RouteBuilder.tsx (#1825) дословно —
// инвариант «ровно один PATCH на переключение» тот же самый.
import React, { useRef, useState } from 'react';

import {
  type PlannedTrip,
  type RoutePoint,
  type TripBikeType,
} from '@/api/plannedTrips';
import { isRoutableTransport } from '@/components/trips/planning/tripRoutePreview';
import { routeSignature } from '@/components/trips/planning/routeBuilderPoint';
import {
  useUpdateTripBikeType,
  useUpdateTripTransport,
} from '@/hooks/usePlannedTripsApi';
import type { useTranslation } from '@/i18n/LocaleProvider';

export function useTripRouteRebuild({
  trip,
  setRoute,
  t,
  isRouteSaveBusy,
}: {
  trip: PlannedTrip;
  setRoute: React.Dispatch<React.SetStateAction<RoutePoint[]>>;
  t: ReturnType<typeof useTranslation>['t'];
  /** Лок и `isPending` сохранения маршрута: тот же экран, тот же поток. */
  isRouteSaveBusy: () => boolean;
}) {
  const updateTripTransport = useUpdateTripTransport();
  const updateTripBikeType = useUpdateTripBikeType();
  // Транспорт и тип велосипеда шлют один и тот же PATCH по одной поездке,
  // поэтому лок общий: параллельных перестроений маршрута быть не должно.
  const transportMutationLockedRef = useRef(false);
  const [transportCommitPending, setTransportCommitPending] = useState(false);
  // Транспорт и тип велосипеда перестраивают маршрут одним потоком, поэтому и
  // ошибка одна: иначе неудача одного контрола висела бы под другим успешным.
  const [routeRebuildError, setRouteRebuildError] = useState<string | null>(null);

  // Инвариант «ровно один PATCH на переключение» держится здесь, а не на
  // `disabled` дочернего контрола: ref ловит повтор в одном тике, isPending —
  // мутацию этого экрана, которая ещё летит.
  const canCommitRouteRebuild = () =>
    !transportMutationLockedRef.current &&
    !isRouteSaveBusy() &&
    !updateTripTransport.isPending &&
    !updateTripBikeType.isPending;

  // Транспорт и тип велосипеда перестраивают маршрут одним и тем же PATCH, поэтому
  // обвязка коммита общая: лок ставится синхронно до mutate, ответ применяется
  // атомарно и не затирает несохранённый черновик маршрута.
  const beginRouteRebuild = () => {
    const persistedRouteSignature = routeSignature(trip.route);
    transportMutationLockedRef.current = true;
    setTransportCommitPending(true);
    setRouteRebuildError(null);

    return {
      onSuccess: (updatedTrip: PlannedTrip) => {
        setRoute((currentRoute) => (
          routeSignature(currentRoute) === persistedRouteSignature
            ? updatedTrip.route
            : currentRoute
        ));
      },
      onError: () => {
        setRouteRebuildError(
          t('trips:components.trips.planning.RouteBuilder.ne_udalos_perestroit_marshrut_poprobuyte_esche_raz_9c4be156'),
        );
      },
      onSettled: () => {
        transportMutationLockedRef.current = false;
        setTransportCommitPending(false);
      },
    };
  };

  const handleTransportChange = (value: string) => {
    if (value === trip.transport || !isRoutableTransport(value) || !canCommitRouteRebuild()) {
      return;
    }

    updateTripTransport.mutate({ tripId: trip.id, transport: value }, beginRouteRebuild());
  };

  const handleBikeTypeChange = (value: TripBikeType) => {
    if (value === trip.bikeType || !canCommitRouteRebuild()) return;

    updateTripBikeType.mutate({ tripId: trip.id, bikeType: value }, beginRouteRebuild());
  };

  return {
    routeRebuildError,
    transportPending:
      transportCommitPending || updateTripTransport.isPending || updateTripBikeType.isPending,
    /** Тот же лок и те же `isPending`, что видит `canCommitRouteRebuild`. */
    isRouteRebuildBusy: () =>
      transportMutationLockedRef.current ||
      updateTripTransport.isPending ||
      updateTripBikeType.isPending,
    handleTransportChange,
    handleBikeTypeChange,
  };
}
