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
 * Получает рейтинг путешествия
 * GET /api/travels/{id}/rating/
 */
export const getTravelRating = async (travelId: number): Promise<TravelRatingResponse> => {
    try {
        const response = await apiClient.get<TravelRatingResponse>(
            `/travels/${travelId}/rating/`
        );
        return response;
    } catch (error) {
        devError('Error fetching travel rating:', error);
        throw error;
    }
};

/**
 * Получает рейтинг путешествия от текущего пользователя
 * GET /api/travels/{travel_id}/rating/users/
 * Возвращает объект с rating пользователя или null если не оценивал
 */
export const getUserTravelRating = async (travelId: number): Promise<number | null> => {
    try {
        const response = await apiClient.get<TravelRatingRecordResponse | TravelRatingRecordResponse[]>(
            `/travels/${travelId}/rating/users/`
        );

        // API может вернуть массив или один объект
        if (Array.isArray(response)) {
            // Если массив — берём первый элемент (рейтинг текущего пользователя)
            return response.length > 0 ? response[0].rating : null;
        }

        // Если один объект
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
 * Получает полную информацию о рейтинге путешествия включая оценку пользователя
 * Комбинирует getTravelRating и getUserTravelRating
 */
export const getTravelRatingWithUserRating = async (travelId: number): Promise<TravelRatingResponse> => {
    try {
        // Параллельно запрашиваем общий рейтинг и рейтинг пользователя
        const [ratingResponse, userRating] = await Promise.all([
            getTravelRating(travelId),
            getUserTravelRating(travelId),
        ]);

        return {
            ...ratingResponse,
            user_rating: userRating,
        };
    } catch (error) {
        devError('Error fetching travel rating with user rating:', error);
        throw error;
    }
};

