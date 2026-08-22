// Аналитика петли возврата после финиша квеста (#1484).
// Тонкие обёртки над sendAnalyticsEvent: имена событий заданы тикетом и не
// должны собираться на месте вызова. Согласие проверяет сам sendAnalyticsEvent.

import { sendAnalyticsEvent } from '@/utils/analytics';

export const QUEST_RETENTION_EVENTS = {
  /** Клик по карточке «следующий квест рядом» на экране финала. */
  nextQuestClick: 'next_quest_click',
  /** Показ полосы «Пройдено N из M квестов города». */
  cityCollectionView: 'city_collection_view',
  /** Возврат в квесты после ранее завершённого квеста. */
  returnVisitAfterFinish: 'return_visit_after_finish',
} as const;

/** Откуда показана коллекция города: экран финала или профиль. */
export type CityCollectionSource = 'quest_finale' | 'profile';

export function trackNextQuestClick(params: {
  questId: string;
  cityId?: string | null;
  fromQuestId?: string | null;
  position: number;
  distanceKm?: number | null;
  otherCity?: boolean;
}): void {
  void sendAnalyticsEvent(QUEST_RETENTION_EVENTS.nextQuestClick, {
    quest_id: params.questId,
    city_id: params.cityId ?? null,
    from_quest_id: params.fromQuestId ?? null,
    position: params.position,
    distance_km: params.distanceKm ?? null,
    other_city: !!params.otherCity,
  });
}

export function trackCityCollectionView(params: {
  cityId: string;
  source: CityCollectionSource;
  completedCount: number;
  totalCount: number;
}): void {
  void sendAnalyticsEvent(QUEST_RETENTION_EVENTS.cityCollectionView, {
    city_id: params.cityId,
    source: params.source,
    completed_count: params.completedCount,
    total_count: params.totalCount,
  });
}

export function trackReturnVisitAfterFinish(params: {
  questId: string;
  cityId?: string | null;
  daysSinceFinish: number;
}): void {
  void sendAnalyticsEvent(QUEST_RETENTION_EVENTS.returnVisitAfterFinish, {
    quest_id: params.questId,
    city_id: params.cityId ?? null,
    days_since_finish: params.daysSinceFinish,
  });
}
