// Аналитика пользовательского следа после финиша квеста (#1486).
// Тонкая обёртка над sendAnalyticsEvent по образцу questRetentionAnalytics:
// имена событий заданы тикетом и не собираются на месте вызова. Согласие
// проверяет сам sendAnalyticsEvent.

import { sendAnalyticsEvent } from '@/utils/analytics';

export const QUEST_REVIEW_EVENTS = {
  /** Отзыв о квесте сохранён на сервере (не «нажата кнопка»). */
  reviewSubmit: 'quest_review_submit',
  /** Фото отзыва подтверждено сервером (не «файл выбран»). */
  photoUpload: 'quest_photo_upload',
  /** Мягкая просьба об отзыве показана игроку (#1795). */
  promptShown: 'quest_review_prompt_shown',
  /** Игрок открыл форму отзыва из просьбы или кнопки на странице квеста (#1795). */
  promptClick: 'quest_review_prompt_click',
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

/**
 * Фото отзыва доехало до сервера. Зовётся по подтверждённой загрузке каждого
 * файла, а не по выбору в пикере: иначе событие начнёт означать «игрок ткнул в
 * галерею», а не «снимок сохранён» (#1579).
 */
export function trackQuestPhotoUpload(params: {
  questId?: string | null;
  cityId?: string | null;
  /** PK отзыва, к которому прикреплено фото. */
  reviewId: number;
}): void {
  void sendAnalyticsEvent(QUEST_REVIEW_EVENTS.photoUpload, {
    quest_id: params.questId ?? null,
    city_id: params.cityId ?? null,
    review_id: params.reviewId,
  });
}

/**
 * Мягкая просьба об отзыве показана в каталоге (#1795). Событие меряет охват
 * просьбы, а не факт отзыва: конверсию считаем парой с `quest_review_submit`.
 */
export function trackQuestReviewPromptShown(params: {
  questId?: string | null;
  cityId?: string | null;
}): void {
  void sendAnalyticsEvent(QUEST_REVIEW_EVENTS.promptShown, {
    quest_id: params.questId ?? null,
    city_id: params.cityId ?? null,
  });
}

/** Игрок пошёл из просьбы/кнопки в форму отзыва (#1795). */
export function trackQuestReviewPromptClick(params: {
  questId?: string | null;
  cityId?: string | null;
  /** Откуда пришёл переход: баннер каталога или кнопка на странице квеста. */
  source: 'catalog_banner' | 'quest_page';
}): void {
  void sendAnalyticsEvent(QUEST_REVIEW_EVENTS.promptClick, {
    quest_id: params.questId ?? null,
    city_id: params.cityId ?? null,
    source: params.source,
  });
}
