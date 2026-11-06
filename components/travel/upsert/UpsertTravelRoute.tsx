import { useCallback, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import TravelFormErrorBoundary from '@/components/travel/TravelFormErrorBoundary';
import UpsertTravel from '@/components/travel/UpsertTravel';
import PlaceRequestEditorEntry, { PlaceRequestEditorUnavailable } from '@/components/travel/upsert/PlaceRequestEditorEntry';
import { buildPlaceRequestCreateHref, parsePlaceRequestCreateIntent } from '@/utils/placeRequestCreateIntent';
import { isPlaceRequestsPilotEnabled } from '@/utils/placeRequestsConfig';
import {
  buildTravelArticleCreateIntentHref,
  parseTravelArticleCreateIntent,
} from '@/utils/travelArticleCreateIntent';
import { parseTravelPublicationMode } from '@/utils/travelNote';
import { normalizeTravelId } from '@/utils/travelFormUtils';

/**
 * Какой вход создания открыт: режим (#2666) и контекст статьи (#2677) в канонической
 * форме, без `id` — его `router.setParams` дописывает после первого сохранения, и
 * смена ключа на этом шаге сбросила бы форму посреди ввода.
 */
export function resolveUpsertTravelEntryKey(params: Record<string, unknown>): string {
  const mode = parseTravelPublicationMode(params);
  if (params.place_request_id !== undefined) {
    const intent = parsePlaceRequestCreateIntent(params);
    return intent ? buildPlaceRequestCreateHref(intent, mode) : '/travel/new?invalid-place-request';
  }
  return buildTravelArticleCreateIntentHref(parseTravelArticleCreateIntent(params), mode);
}

// Единый route-компонент для web и native. Раньше native-ветка размонтировала
// форму при потере фокуса экрана (`if (!isFocused) return null`), из-за чего
// уход и возврат в мастер терял весь введённый стейт. Держим форму
// смонтированной на всех платформах — как это всегда было на web.
//
// Контроллер читает режим и контекст статьи из URL один раз, а экран вкладки
// переиспользуется при переходе на тот же маршрут с другими параметрами. Поэтому
// другой вход («Короткая заметка» после полного мастера, CTA другой статьи, #2829)
// пересоздаёт форму, а возврат на тот же адрес сохраняет набранное.
export default function UpsertTravelRoute() {
  const [retryKey, setRetryKey] = useState(0);
  const params = useLocalSearchParams();
  const entryKey = resolveUpsertTravelEntryKey(params);
  const campaignIntent = useMemo(() => parsePlaceRequestCreateIntent({
    place_request_id: params.place_request_id,
    contribution_source: params.contribution_source,
  }), [params.place_request_id, params.contribution_source]);
  const isCampaignEntry = params.place_request_id !== undefined;
  const pilotEnabled = isPlaceRequestsPilotEnabled();
  const hasId = Boolean(params.id);
  const parsedId = normalizeTravelId(params.id);
  const hasSavedId = parsedId != null && parsedId > 0 && Number.isSafeInteger(parsedId);
  const [entry, setEntry] = useState({ hasId, revision: 0 });

  // Первое сохранение добавляет id без сброса. Повторный вход «создать»
  // снимает его через setParams (push того же экрана id оставляет, #2829):
  // прежняя запись не должна остаться в форме новой заметки или статьи.
  if (entry.hasId !== hasId) {
    setEntry({ hasId, revision: entry.revision + (hasId ? 0 : 1) });
  }

  const handleRetry = useCallback(() => {
    setRetryKey((value) => value + 1);
  }, []);

  return (
    <TravelFormErrorBoundary key={`${retryKey}:${entry.revision}:${entryKey}`} onRetry={handleRetry}>
      {isCampaignEntry && (pilotEnabled || !hasSavedId)
        ? campaignIntent && pilotEnabled
          ? <PlaceRequestEditorEntry intent={campaignIntent} hasId={hasSavedId} />
          : <PlaceRequestEditorUnavailable />
        : <UpsertTravel />}
    </TravelFormErrorBoundary>
  );
}
