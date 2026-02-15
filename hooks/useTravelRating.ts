// hooks/useTravelRating.ts
// ✅ Хук для управления рейтингом путешествия

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rateTravel, getTravelRating, TravelRatingResponse } from '@/api/travelRating';
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

    // Query для получения рейтинга (если нужно обновить с сервера)
    const ratingQuery = useQuery({
        queryKey: ['travelRating', travelId],
        queryFn: () => getTravelRating(travelId!),
        enabled: enabled && !!travelId && isAuthenticated,
        staleTime: 5 * 60 * 1000, // 5 минут
        initialData: initialRating !== null || initialUserRating !== null
            ? {
                rating: initialRating ?? 0,
                rating_count: initialCount,
                user_rating: initialUserRating,
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
            await queryClient.cancelQueries({ queryKey: ['travelRating', travelId] });

            // Сохраняем предыдущее состояние
            const previousData = queryClient.getQueryData<TravelRatingResponse>(['travelRating', travelId]);

            return { previousData };
        },
        onError: (_error, _newRating, context) => {
            // Откатываем к предыдущему состоянию
            setOptimisticRating(null);
            if (context?.previousData) {
                queryClient.setQueryData(['travelRating', travelId], context.previousData);
            }
            showToast({
                text1: 'Не удалось сохранить оценку',
                type: 'error',
            });
        },
        onSuccess: (data) => {
            // Обновляем кэш
            setOptimisticRating(null);
            queryClient.setQueryData(['travelRating', travelId], data);

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

    if (previousUserRating !== null) {
        // Пользователь меняет свою оценку
        const totalSum = currentRating * count;
        const newSum = totalSum - previousUserRating + newValue;
        return newSum / count;
    } else {
        // Пользователь ставит оценку впервые
        const totalSum = currentRating * count;
        const newSum = totalSum + newValue;
        return newSum / (count + 1);
    }
}

export default useTravelRating;

