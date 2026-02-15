// api/articleRating.ts
// ✅ API для работы с рейтингом статей

import { apiClient } from '@/api/client';
import { devError } from '@/utils/logger';

export type ArticleRatingResponse = {
    rating: number;
    rating_count: number;
    user_rating: number | null;
};

export type RateArticleParams = {
    articleId: number;
    rating: number; // 1-5
};

/**
 * Отправляет оценку статьи
 * POST /api/articles/{id}/rating/
 */
export const rateArticle = async (params: RateArticleParams): Promise<ArticleRatingResponse> => {
    const { articleId, rating } = params;

    if (rating < 1 || rating > 5) {
        throw new Error('Рейтинг должен быть от 1 до 5');
    }

    try {
        const response = await apiClient.post<ArticleRatingResponse>(
            `/articles/${articleId}/rating/`,
            { rating }
        );
        return response;
    } catch (error) {
        devError('Error rating article:', error);
        throw error;
    }
};

/**
 * Получает рейтинг статьи
 * GET /api/articles/{id}/rating/
 */
export const getArticleRating = async (articleId: number): Promise<ArticleRatingResponse> => {
    try {
        const response = await apiClient.get<ArticleRatingResponse>(
            `/articles/${articleId}/rating/`
        );
        return response;
    } catch (error) {
        devError('Error fetching article rating:', error);
        throw error;
    }
};
