// api/travelRating.ts
// API для работы с рейтингом путешествий

import { apiClient } from '@/api/client';
import { devError } from '@/utils/logger';
import { useAuthStore } from '@/stores/authStore';

export type TravelRatingResponse = {
    rating: number;
    rating_count: number;
    user_rating: number | null;
};

export type TravelRatingRecordResponse = {
    id: number;
    user: number;
    travel: number;
    rating: number;
};

export type RateTravelParams = {
    travelId: number;
    rating: number; // 1-5
};

/**
 * Отправляет оценку путешествия
 * POST /api/travels/rating/
 * Тело: { travel: number, rating: number }
 */
export const rateTravel = async (params: RateTravelParams): Promise<TravelRatingResponse> => {
    const { travelId, rating } = params;

    if (rating < 1 || rating > 5) {
        throw new Error('Рейтинг должен быть от 1 до 5');
    }

    try {
        const userIdRaw = useAuthStore.getState().userId;
        const userId = userIdRaw ? Number(userIdRaw) : null;

        const response = await apiClient.post<TravelRatingResponse>(
            '/travels/rating/',
            userId && Number.isFinite(userId)
                ? { user: userId, travel: travelId, rating }
                : { travel: travelId, rating }
        );
        return response;
    } catch (error) {
        devError('Error rating travel:', error);
        throw error;
    }
};

/**
 * Получает рейтинг путешествия от текущего пользователя
 * GET /api/travels/travel{travel_id}/rating/users/{user_id}/
 * Возвращает объект с rating пользователя или null если не оценивал
 */
export const getUserTravelRating = async (travelId: number): Promise<number | null> => {
    try {
        const userIdRaw = useAuthStore.getState().userId;
        const userId = userIdRaw ? Number(userIdRaw) : null;

        if (!userId || !Number.isFinite(userId)) {
            return null;
        }

        const response = await apiClient.get<TravelRatingRecordResponse>(
            `/travels/travel${travelId}/rating/users/${userId}/`
        );

        if (response && typeof response.rating === 'number') {
            return response.rating;
        }

        return null;
    } catch (error: any) {
        // 404 означает что пользователь ещё не оценивал
        if (error?.status === 404) {
            return null;
        }
        devError('Error fetching user travel rating:', error);
        return null;
    }
};

/**
 * Получает оценку пользователя для путешествия.
 * Агрегатный рейтинг (rating, rating_count) приходит из travel detail response,
 * отдельного GET-эндпоинта для него нет.
 */
export const fetchUserRatingForTravel = async (travelId: number): Promise<number | null> => {
    return getUserTravelRating(travelId);
};

