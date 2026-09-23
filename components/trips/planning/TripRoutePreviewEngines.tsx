// components/trips/planning/TripRoutePreviewEngines.tsx
// #2056: по headless-движку превью на каждый прогон маршрута. Переезды (поезд,
// перелёт, …) не прокладываются, поэтому прогоны строятся отдельно — там же,
// где бэкенд режет сохранённую сводку (#2055), и один непроходимый отрезок
// больше не роняет в прямую весь маршрут. Без переездов прогон один, и монтаж
// тот же, что до #2056: один движок со всеми точками.
import React, { useMemo } from 'react';

import type { UseMapRoutingResult } from '@/components/map-core/useMapRouting';
import TripRoutePreviewEngine from './TripRoutePreviewEngine';
import type { TripRoutePreviewState } from './useTripRoutePreview';

interface Props {
  preview: Pick<
    TripRoutePreviewState,
    'active' | 'transportMode' | 'runs' | 'retryToken' | 'handleRunResult'
  >;
}

export default function TripRoutePreviewEngines({ preview }: Props) {
  const { active, transportMode, runs, retryToken, handleRunResult } = preview;
  // Обработчик прогона стабилен, пока не сменился запрос: новый колбэк на каждый
  // рендер движок пережил бы (он держит его в ref), но подписчики на `onResult`
  // считали бы это новым монтажом.
  const handlers = useMemo(
    () => runs.map((_, index) => (result: UseMapRoutingResult) => handleRunResult(index, result)),
    [handleRunResult, runs],
  );
  if (!active || !transportMode) return null;
  return (
    <>
      {runs.map((points, index) => (
        // Ключ с retryToken: у useRouting нет входа «построй заново», а
        // деградированный ответ он намеренно не кэширует (ROUTING-ORS-001).
        <TripRoutePreviewEngine
          key={`${retryToken}:${index}`}
          points={points}
          transportMode={transportMode}
          onResult={handlers[index]}
        />
      ))}
    </>
  );
}
