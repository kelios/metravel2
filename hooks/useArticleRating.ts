// hooks/useArticleRating.ts
// ✅ Хук для управления рейтингом статьи

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rateArticle, getArticleRating, ArticleRatingResponse } from '@/api/articleRating';
import { useAuth } from '@/context/AuthContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { showToast } from '@/utils/toast';

type UseArticleRatingOptions = {
    articleId: number | undefined;
    initialRating?: number | null;
    initialCount?: number;
    initialUserRating?: number | null;
    enabled?: boolean;
};

type UseArticleRatingReturn = {
    rating: number | null;
    ratingCount: number;
    userRating: number | null;
    isLoading: boolean;
    isSubmitting: boolean;
    canRate: boolean;
    handleRate: (value: number) => void;
    error: Error | null;
};

export function useArticleRating({
    articleId,
    initialRating = null,
    initialCount = 0,
    initialUserRating = null,
    enabled = true,
}: UseArticleRatingOptions): UseArticleRatingReturn {
    const { isAuthenticated } = useAuth();
    const { requireAuth } = useRequireAuth({ intent: 'rate' });
    const queryClient = useQueryClient();

    const [optimisticRating, setOptimisticRating] = useState<number | null>(null);

    // Query для получения рейтинга
    // Для авторизованных пользователей всегда делаем запрос, чтобы получить user_rating
    const ratingQuery = useQuery({
        queryKey: ['articleRating', articleId, isAuthenticated],
        queryFn: () => getArticleRating(articleId!),
        enabled: enabled && !!articleId && isAuthenticated,
        staleTime: 30 * 1000, // 30 секунд — чтобы быстрее обновлять user_rating
        placeholderData: (initialRating != null || initialUserRating != null)
            ? {
                rating: initialRating ?? 0,
                rating_count: initialCount,
                user_rating: initialUserRating ?? null,
            }
            : undefined,
    });

    // Mutation для отправки оценки
    const rateMutation = useMutation({
        mutationFn: (rating: number) => rateArticle({ articleId: articleId!, rating }),
        onMutate: async (newRating) => {
            setOptimisticRating(newRating);
            await queryClient.cancelQueries({ queryKey: ['articleRating', articleId, isAuthenticated] });
            const previousData = queryClient.getQueryData<ArticleRatingResponse>(['articleRating', articleId, isAuthenticated]);
            return { previousData };
        },
        onError: (_error, _newRating, context) => {
            setOptimisticRating(null);
            if (context?.previousData) {
                queryClient.setQueryData(['articleRating', articleId, isAuthenticated], context.previousData);
            }
            showToast({
                text1: 'Не удалось сохранить оценку',
                type: 'error',
            });
        },
        onSuccess: (data) => {
            setOptimisticRating(null);
            queryClient.setQueryData(['articleRating', articleId, isAuthenticated], data);

            // Инвалидируем кэш статьи, если он есть
            queryClient.invalidateQueries({ queryKey: ['article', articleId] });

            showToast({
                text1: 'Оценка сохранена',
                type: 'success',
            });
        },
    });

    const handleRate = useCallback((value: number) => {
        if (!articleId) return;

        if (!isAuthenticated) {
            requireAuth();
            return;
        }

        rateMutation.mutate(value);
    }, [articleId, isAuthenticated, requireAuth, rateMutation]);

    const currentData = ratingQuery.data;
    const effectiveUserRating = optimisticRating ?? currentData?.user_rating ?? initialUserRating;

    const effectiveRating = optimisticRating !== null && currentData
        ? calculateNewRating(
            currentData.rating,
            currentData.rating_count,
            optimisticRating,
            currentData.user_rating
        )
        : currentData?.rating ?? initialRating;

    const effectiveCount = optimisticRating !== null && currentData && currentData.user_rating === null
        ? currentData.rating_count + 1
        : currentData?.rating_count ?? initialCount;

    return {
        rating: effectiveRating,
        ratingCount: effectiveCount,
        userRating: effectiveUserRating,
        isLoading: ratingQuery.isLoading,
        isSubmitting: rateMutation.isPending,
        canRate: isAuthenticated,
        handleRate,
        error: ratingQuery.error || rateMutation.error,
    };
}

function calculateNewRating(
    currentRating: number,
    count: number,
    newValue: number,
    previousUserRating: number | null
): number {
    if (count === 0) return newValue;

    if (previousUserRating !== null && previousUserRating !== 0) {
        // Пользователь меняет свою оценку
        const totalSum = currentRating * count;
        const newSum = totalSum - previousUserRating + newValue;
        return Number((newSum / count).toFixed(1));
    } else {
        // Пользователь ставит оценку впервые
        const totalSum = currentRating * count;
        const newSum = totalSum + newValue;
        return Number((newSum / (count + 1)).toFixed(1));
    }
}

export default useArticleRating;
