// Аналитика пользовательского следа после финиша квеста (#1486).
// Тонкая обёртка над sendAnalyticsEvent по образцу questRetentionAnalytics:
// имена событий заданы тикетом и не собираются на месте вызова. Согласие
// проверяет сам sendAnalyticsEvent.

import { sendAnalyticsEvent } from '@/utils/analytics';

export const QUEST_REVIEW_EVENTS = {
  /** Отзыв о квесте сохранён на сервере (не «нажата кнопка»). */
  reviewSubmit: 'quest_review_submit',
} as const;

/**
 * Отзыв сохранён. Зовётся только из точки подтверждённого успеха: событие
 * должно сходиться со строками в базе, иначе счётчик отзывов в аналитике
 * начнёт жить своей жизнью.
 */
export function trackQuestReviewSubmit(params: {
  questId?: string | null;
  cityId?: string | null;
  rating: number;
  hasText: boolean;
}): void {
  void sendAnalyticsEvent(QUEST_REVIEW_EVENTS.reviewSubmit, {
    quest_id: params.questId ?? null,
    city_id: params.cityId ?? null,
    rating: params.rating,
    has_text: params.hasText,
  });
}
