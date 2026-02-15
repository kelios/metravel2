// api/travelRating.ts
// ✅ API для работы с рейтингом путешествий

import { apiClient } from '@/api/client';
import { devError } from '@/utils/logger';

export type TravelRatingResponse = {
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
        const response = await apiClient.post<TravelRatingResponse>(
            '/travels/rating/',
            { travel: travelId, rating }
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

