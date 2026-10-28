import { useCallback, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import TravelFormErrorBoundary from '@/components/travel/TravelFormErrorBoundary';
import UpsertTravel from '@/components/travel/UpsertTravel';
import {
  buildTravelArticleCreateIntentHref,
  parseTravelArticleCreateIntent,
} from '@/utils/travelArticleCreateIntent';
import { parseTravelPublicationMode } from '@/utils/travelNote';

/**
 * Какой вход создания открыт: режим (#2666) и контекст статьи (#2677) в канонической
 * форме, без `id` — его `router.setParams` дописывает после первого сохранения, и
 * смена ключа на этом шаге сбросила бы форму посреди ввода.
 */
export function resolveUpsertTravelEntryKey(params: Record<string, unknown>): string {
  return buildTravelArticleCreateIntentHref(
    parseTravelArticleCreateIntent(params),
    parseTravelPublicationMode(params),
  );
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
  const hasId = Boolean(params.id);
  const [entry, setEntry] = useState({ hasId, revision: 0 });

  // Первое сохранение добавляет id без сброса. Повторный вход «создать» удаляет
  // его: прежняя запись не должна остаться в форме новой заметки или статьи.
  if (entry.hasId !== hasId) {
    setEntry({ hasId, revision: entry.revision + (hasId ? 0 : 1) });
  }

  const handleRetry = useCallback(() => {
    setRetryKey((value) => value + 1);
  }, []);

  return (
    <TravelFormErrorBoundary key={`${retryKey}:${entry.revision}:${entryKey}`} onRetry={handleRetry}>
      <UpsertTravel />
    </TravelFormErrorBoundary>
  );
}
