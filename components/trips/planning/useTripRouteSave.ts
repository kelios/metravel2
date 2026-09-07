// components/trips/planning/useTripRouteSave.ts
// Сохранение маршрута поездки: отказ PUT, его привязка к подписи черновика и
// сам коммит. Вынесено из RouteBuilder.tsx (#1825) дословно.
//
// Лок сохранения (`routeSaveLockedRef`) и сама мутация приходят из контейнера, а
// не заводятся здесь: тот же лок читает перестроение маршрута
// (`useTripRouteRebuild`), и общая точка этой связки обязана оставаться на
// виду, а не прятаться за двумя хуками, ссылающимися друг на друга.
import React, { useState } from 'react';

import { type RoutePoint } from '@/api/plannedTrips';
import { routeSignature } from '@/components/trips/planning/routeBuilderPoint';
import type { useUpdateTripRoute } from '@/hooks/usePlannedTripsApi';
import { translate as i18nT } from '@/i18n'

export function useTripRouteSave({
  tripId,
  route,
  setRoute,
  currentRouteSignature,
  hasUnsavedRouteChanges,
  routeSaveLockedRef,
  updateTripRoute,
  isRouteRebuildBusy,
  uploadPendingOriginal,
}: {
  tripId: number;
  route: RoutePoint[];
  setRoute: React.Dispatch<React.SetStateAction<RoutePoint[]>>;
  currentRouteSignature: string;
  hasUnsavedRouteChanges: boolean;
  routeSaveLockedRef: React.MutableRefObject<boolean>;
  updateTripRoute: ReturnType<typeof useUpdateTripRoute>;
  isRouteRebuildBusy: () => boolean;
  uploadPendingOriginal: () => Promise<void>;
}) {
  // Отказ `PUT /route/` (например 400 от валидации точек) до этого нигде не
  // всплывал: у мутации был только `onSuccess`, поэтому кнопка гасла, маршрут
  // не сохранялся и пользователь не получал ни одного признака ошибки.
  //
  // Вместе с текстом храним подпись маршрута, на котором отказ случился: ошибка
  // остаётся оценкой ровно того набора точек, который её вызвал. Как только на
  // экране другой маршрут — правка точки, новый импорт, откат и повторная
  // правка — сообщение само перестаёт показываться, без россыпи сбросов по всем
  // местам, где меняется `route`.
  const [routeSaveError, setRouteSaveError] = useState<
    { message: string; signature: string } | null
  >(null);

  const handleSave = () => {
    if (routeSaveLockedRef.current || isRouteRebuildBusy()) {
      return;
    }

    // После успешного сохранения точек загрузка оригинала могла упасть. В таком
    // состоянии повторная кнопка ретраит только файл и не делает лишний PUT
    // неизменившегося маршрута.
    if (!hasUnsavedRouteChanges) {
      void uploadPendingOriginal();
      return;
    }

    // #1824: подпись черновика, который уходит на сервер. Ответ применяется
    // только если за время запроса на экране остался ровно он. Иначе правка,
    // сделанная во время сохранения — перетаскивание маркера, переименование
    // точки, новая точка, — была бы молча затёрта серверным ответом; на
    // медленной сети окно потери равно времени запроса.
    //
    // При расхождении на экране остаются правки пользователя, а не серверный
    // ответ, и это НЕ тихое расхождение: `hasUnsavedRouteChanges` сравнивает
    // черновик уже с новым `trip.route`, поэтому кнопка сохранения остаётся на
    // месте и честно говорит, что есть что отправить. PUT заменяет маршрут
    // целиком (`api/plannedTripsRequests.ts:452`), так что повторное сохранение
    // разошедшегося черновика дублей точек не создаёт.
    const submittedRouteSignature = currentRouteSignature;
    setRouteSaveError(null);
    routeSaveLockedRef.current = true;
    updateTripRoute.mutate(
      { tripId, route },
      {
        onSuccess: (updatedTrip) => {
          setRoute((currentRoute) => (
            routeSignature(currentRoute) === submittedRouteSignature
              ? updatedTrip.route
              : currentRoute
          ));
          void uploadPendingOriginal();
        },
        onError: () => {
          setRouteSaveError({
            message: i18nT('tripsStatic:plan.route.saveError'),
            signature: submittedRouteSignature,
          });
        },
        onSettled: () => {
          routeSaveLockedRef.current = false;
        },
      },
    );
  };

  return {
    handleSave,
    visibleRouteSaveError:
      routeSaveError && routeSaveError.signature === currentRouteSignature
        ? routeSaveError.message
        : null,
  };
}
