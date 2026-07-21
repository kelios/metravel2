// api/placeRating.ts
// API для собственного (MeTravel) рейтинга мест каталога /places.
// Зеркалит контракт рейтинга статей (api/articleRating.ts): агрегат + оценка
// текущего пользователя приходят одним GET, POST возвращает обновлённый агрегат.

import { apiClient } from '@/api/client';
import { devError } from '@/utils/logger';
import { translate as i18nT } from '@/i18n';

export type PlaceRatingResponse = {
  rating: number;
  rating_count: number;
  user_rating: number | null;
};

export type RatePlaceParams = {
  placeId: string | number;
  rating: number; // 1-5
};

/**
 * Ответ эндпоинта нормализуется: контракт задачи #986 описывал
 * `{ value, count, userValue }`, а рейтинги статей/путешествий в этом проекте
 * отдают `{ rating, rating_count, user_rating }`. Какой из вариантов реально
 * задеплоен на бэке — по неавторизованной пробе не видно (401 до валидации),
 * поэтому принимаем оба и не даём UI сломаться о переименование поля.
 */
const normalizeRatingResponse = (raw: unknown): PlaceRatingResponse => {
  const data = (raw ?? {}) as Record<string, unknown>;
  const toNumber = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  const toNullableNumber = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;

  return {
    rating: toNumber(data.rating ?? data.value, 0),
    rating_count: toNumber(data.rating_count ?? data.count, 0),
    user_rating: toNullableNumber(data.user_rating ?? data.userValue ?? data.user_value),
  };
};

/**
 * Отправляет оценку места.
 * POST /api/places/{id}/rating/  тело: { rating }
 */
export const ratePlace = async (params: RatePlaceParams): Promise<PlaceRatingResponse> => {
  const { placeId, rating } = params;

  if (rating < 1 || rating > 5) {
    throw new Error(i18nT('errorsStatic:api.common.ratingRange'));
  }

  try {
    const response = await apiClient.post<unknown>(
      `/places/${encodeURIComponent(String(placeId))}/rating/`,
      // Оба имени поля: `rating` (как у рейтинга статей) и `value` (как в
      // контракте #986). Лишний ключ DRF-сериализатор игнорирует.
      { rating, value: rating },
    );
    return normalizeRatingResponse(response);
  } catch (error) {
    devError('Error rating place:', error);
    throw error;
  }
};

/**
 * Получает агрегатный рейтинг места и оценку текущего пользователя.
 * GET /api/places/{id}/rating/
 */
export const getPlaceRating = async (placeId: string | number): Promise<PlaceRatingResponse> => {
  try {
    const response = await apiClient.get<unknown>(
      `/places/${encodeURIComponent(String(placeId))}/rating/`,
    );
    return normalizeRatingResponse(response);
  } catch (error) {
    devError('Error fetching place rating:', error);
    throw error;
  }
};
