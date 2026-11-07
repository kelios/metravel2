import React, { Suspense, useCallback } from 'react';

import type { RouteNearSuggestionsProps } from '@/components/trips/planning/RouteNearSuggestions';
import { type RoutePoint, type RoutePointType } from '@/api/plannedTrips';
import { isAiPicksEnabled } from '@/utils/aiPicksConfig';
import { trackRoutePointAdded } from '@/utils/tripAnalytics';

// #2911: блок «Рядом с маршрутом» — отложенный чанк по литеральному флагу (#2738, как
// `TravelWizardStepExtras` грузит подсказку значений): без `EXPO_PUBLIC_AI_PICKS` в сборке
// нет ни блока, ни `api/aiPicks`, а запросов к `/ai/*` планировщик не делает. Вынесен из
// `RouteBuilder.tsx`, чтобы контейнер оставался под порогом 800 LOC (`guard:file-complexity`).
type NearSuggestionsModule = { default: React.ComponentType<RouteNearSuggestionsProps> };
const EmptyNearSuggestions: React.ComponentType<RouteNearSuggestionsProps> = () => null;
const RouteNearSuggestions = React.lazy<React.ComponentType<RouteNearSuggestionsProps>>(
  () =>
    (process.env.EXPO_PUBLIC_AI_PICKS
      ? import('@/components/trips/planning/RouteNearSuggestions')
      : Promise.resolve({ default: EmptyNearSuggestions })) as Promise<NearSuggestionsModule>,
);

export interface RouteNearSuggestionsSlotProps {
  route: RoutePoint[];
  tripId: number;
  setRoute: React.Dispatch<React.SetStateAction<RoutePoint[]>>;
}

/** Секция «Рядом с маршрутом» конструктора: `null` без флага, иначе отложенный блок с карточками. */
export default function RouteNearSuggestionsSlot({ route, tripId, setRoute }: RouteNearSuggestionsSlotProps) {
  // Точка из карточки «Рядом с маршрутом». Статья — «Место» с привязкой `placeId` (как выбор в
  // поиске по сайту), квест в домене точки не существует — обычная точка с координатами
  // источника; `name` и `description` редактируются как у любой.
  const handleAddAiPoint = useCallback<RouteNearSuggestionsProps['onAddPoint']>((item) => {
    if (item.lat === null || item.lng === null) return;
    const type: RoutePointType = item.type === 'travel' ? 'place' : 'custom';
    const coordinates: [number, number] = [item.lng, item.lat];
    setRoute((prev) => [
      ...prev,
      {
        id: `ai-${item.type}-${item.source_id}-${prev.length}`,
        type,
        name: item.title.trim(),
        description: item.snippet.trim() || null,
        coordinates,
        placeId: item.type === 'travel' ? item.source_id : null,
        dayNumber: null,
      },
    ]);
    trackRoutePointAdded(tripId, type);
  }, [setRoute, tripId]);

  if (!isAiPicksEnabled()) return null;
  return (
    <Suspense fallback={null}>
      <RouteNearSuggestions route={route} onAddPoint={handleAddAiPoint} />
    </Suspense>
  );
}
