// components/trips/planning/TripRoutePreviewEngine.tsx
// Headless-движок живого превью маршрута в конструкторе поездки (#1490).
//
// Ровно тот же движок, что строит маршрут на /map: `useMapRouting` →
// `useRouting` (цепочка `POST /routing/route/` → ORS → Valhalla → OSRM) плюс
// `useElevation`. Своей цепочки провайдеров здесь нет и быть не должно.
//
// Компонент headless и монтируется под ключом `retryToken`: у `useRouting` нет
// внешнего входа «построй заново», а деградированный результат он намеренно не
// кладёт в кэш (`ROUTING-ORS-001`), поэтому свежий монтаж — это и есть повтор.
// #1148: точечный импорт вместо барреля `components/map-core` — тот тянет
// инлайн-Leaflet для native WebView в web-граф.
import { useEffect, useRef } from 'react';

import {
  useMapRouting,
  type UseMapRoutingResult,
} from '@/components/map-core/useMapRouting';
import type { RoutableTripTransport } from '@/api/plannedTrips';

interface Props {
  /** Точки маршрута как [lng, lat] — уже отфильтрованные и задебаунсенные родителем. */
  points: Array<[number, number]>;
  transportMode: RoutableTripTransport;
  onResult: (result: UseMapRoutingResult) => void;
}

export default function TripRoutePreviewEngine({ points, transportMode, onResult }: Props) {
  // Тосты «маршрут построен» здесь выключены: в конструкторе маршрут
  // перестраивается на каждую правку точки, и на /map-овской громкости это был
  // бы поток уведомлений вместо обратной связи.
  const result = useMapRouting({
    routePoints: points,
    transportMode,
    apiKey: process.env.EXPO_PUBLIC_ORS_API_KEY,
    showToasts: false,
  });

  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  // Читаем возвращаемое значение хука, а не его `onRouteChange`: тот отдаёт
  // результат по собственному ключу состояния, в котором замеров высот нет.
  useEffect(() => {
    onResultRef.current(result);
  }, [result]);

  return null;
}
