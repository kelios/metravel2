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
 * Отправляет оценку места.
 * POST /api/places/{id}/rating/  тело: { rating }
 */
export const ratePlace = async (params: RatePlaceParams): Promise<PlaceRatingResponse> => {
  const { placeId, rating } = params;

  if (rating < 1 || rating > 5) {
    throw new Error(i18nT('errorsStatic:api.common.ratingRange'));
  }

  try {
    return await apiClient.post<PlaceRatingResponse>(
      `/places/${encodeURIComponent(String(placeId))}/rating/`,
      { rating },
    );
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
    return await apiClient.get<PlaceRatingResponse>(
      `/places/${encodeURIComponent(String(placeId))}/rating/`,
    );
  } catch (error) {
    devError('Error fetching place rating:', error);
    throw error;
  }
};
