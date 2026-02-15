// hooks/useTravelRating.ts
// ✅ Хук для управления рейтингом путешествия

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rateTravel, getTravelRatingWithUserRating, TravelRatingResponse } from '@/api/travelRating';
import { useAuth } from '@/context/AuthContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { showToast } from '@/utils/toast';
import { queryKeys } from '@/queryKeys';

type UseTravelRatingOptions = {
    travelId: number | undefined;
    initialRating?: number | null;
    initialCount?: number;
    initialUserRating?: number | null;
    enabled?: boolean;
};

type UseTravelRatingReturn = {
    rating: number | null;
    ratingCount: number;
    userRating: number | null;
    isLoading: boolean;
    isSubmitting: boolean;
    canRate: boolean;
    handleRate: (value: number) => void;
    error: Error | null;
};

export function useTravelRating({
    travelId,
    initialRating = null,
    initialCount = 0,
    initialUserRating = null,
    enabled = true,
}: UseTravelRatingOptions): UseTravelRatingReturn {
    const { isAuthenticated } = useAuth();
    const { requireAuth } = useRequireAuth({ intent: 'rate' });
    const queryClient = useQueryClient();

    const [optimisticRating, setOptimisticRating] = useState<number | null>(null);

    // Query для получения рейтинга
    // Для авторизованных пользователей запрашиваем также user_rating через /rating/users/
    const ratingQuery = useQuery({
        queryKey: ['travelRating', travelId, isAuthenticated],
        queryFn: () => getTravelRatingWithUserRating(travelId!),
        enabled: enabled && !!travelId && isAuthenticated,
        staleTime: 30 * 1000, // 30 секунд — чтобы быстрее обновлять user_rating
        placeholderData: (initialRating != null || initialCount > 0 || initialUserRating != null)
            ? {
                rating: initialRating ?? 0,
                rating_count: initialCount,
                user_rating: initialUserRating ?? null,
            }
            : undefined,
    });

    // Mutation для отправки оценки
    const rateMutation = useMutation({
        mutationFn: (rating: number) => rateTravel({ travelId: travelId!, rating }),
        onMutate: async (newRating) => {
            // Оптимистичное обновление
            setOptimisticRating(newRating);

            // Отменяем исходящие запросы
            await queryClient.cancelQueries({ queryKey: ['travelRating', travelId, isAuthenticated] });

            // Сохраняем предыдущее состояние
            const previousData = queryClient.getQueryData<TravelRatingResponse>(['travelRating', travelId, isAuthenticated]);

            // Обновляем кэш оптимистично
            if (previousData) {
                const newEffectiveRating = calculateNewRating(
                    previousData.rating,
                    previousData.rating_count,
                    newRating,
                    previousData.user_rating
                );
                const newEffectiveCount = previousData.user_rating === null 
                    ? previousData.rating_count + 1 
                    : previousData.rating_count;

                queryClient.setQueryData(['travelRating', travelId, isAuthenticated], {
                    ...previousData,
                    rating: newEffectiveRating,
                    rating_count: newEffectiveCount,
                    user_rating: newRating,
                });
            }

            return { previousData };
        },
        onError: (_error, _newRating, context) => {
            // Откатываем к предыдущему состоянию
            setOptimisticRating(null);
            if (context?.previousData) {
                queryClient.setQueryData(['travelRating', travelId, isAuthenticated], context.previousData);
            }
            showToast({
                text1: 'Не удалось сохранить оценку',
                type: 'error',
            });
        },
        onSuccess: (data) => {
            // Обновляем кэш
            setOptimisticRating(null);
            queryClient.setQueryData(['travelRating', travelId, isAuthenticated], data);

            // Инвалидируем кэш путешествия, чтобы обновить рейтинг в списках
            queryClient.invalidateQueries({ queryKey: queryKeys.travel(travelId!) });

            showToast({
                text1: 'Оценка сохранена',
                type: 'success',
            });
        },
    });

    const handleRate = useCallback((value: number) => {
        if (!travelId) return;

        if (!isAuthenticated) {
            requireAuth();
            return;
        }

        rateMutation.mutate(value);
    }, [travelId, isAuthenticated, requireAuth, rateMutation]);

    // Определяем текущие значения (с учётом оптимистичного обновления)
    const currentData = ratingQuery.data;
    const effectiveUserRating = optimisticRating ?? currentData?.user_rating ?? initialUserRating;

    // Вычисляем приблизительный новый рейтинг при оптимистичном обновлении
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

/**
 * Вычисляет приблизительный новый рейтинг при добавлении/изменении оценки
 */
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

export default useTravelRating;
