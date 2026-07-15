// hooks/useArticleRating.ts
// ✅ Хук для управления рейтингом статьи

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rateArticle, getArticleRating, ArticleRatingResponse } from '@/api/articleRating';
import { queryKeys } from '@/api/queryKeys';
import { useAuth } from '@/context/AuthContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { showToast } from '@/utils/toast';
import { calculateNewRating } from '@/utils/ratingHelpers';
import { translate as i18nT } from '@/i18n'


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
        queryKey: queryKeys.articleRating(articleId, isAuthenticated),
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
            await queryClient.cancelQueries({ queryKey: queryKeys.articleRating(articleId, isAuthenticated) });
            const previousData = queryClient.getQueryData<ArticleRatingResponse>(queryKeys.articleRating(articleId, isAuthenticated));
            return { previousData };
        },
        onError: (_error, _newRating, context) => {
            setOptimisticRating(null);
            if (context?.previousData) {
                queryClient.setQueryData(queryKeys.articleRating(articleId, isAuthenticated), context.previousData);
            }
            showToast({
                text1: i18nT('shared:hooks.useArticleRating.ne_udalos_sohranit_otsenku_b527e142'),
                type: 'error',
            });
        },
        onSuccess: (data) => {
            setOptimisticRating(null);
            queryClient.setQueryData(queryKeys.articleRating(articleId, isAuthenticated), data);

            // Инвалидируем кэш статьи, если он есть
            queryClient.invalidateQueries({ queryKey: queryKeys.article(articleId) });

            showToast({
                text1: i18nT('shared:hooks.useArticleRating.otsenka_sohranena_6cf770b3'),
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

export default useArticleRating;
