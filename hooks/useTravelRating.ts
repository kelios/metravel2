// hooks/useTravelRating.ts
// ✅ Хук для управления рейтингом путешествия

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rateTravel, getUserTravelRating } from '@/api/travelRating';
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
    const [serverRating, setServerRating] = useState<number | null>(null);
    const [serverCount, setServerCount] = useState<number | null>(null);

    // Query для получения оценки пользователя
    // Агрегатный рейтинг (rating, rating_count) приходит из travel detail response (initialRating/initialCount)
    const userRatingQuery = useQuery({
        queryKey: ['travelUserRating', travelId],
        queryFn: () => getUserTravelRating(travelId!),
        enabled: enabled && !!travelId && isAuthenticated,
        staleTime: 30 * 1000,
        placeholderData: initialUserRating,
    });

    // Mutation для отправки оценки
    const rateMutation = useMutation({
        mutationFn: (rating: number) => rateTravel({ travelId: travelId!, rating }),
        onMutate: async (newRating) => {
            // Оптимистичное обновление
            setOptimisticRating(newRating);

            // Отменяем исходящие запросы
            await queryClient.cancelQueries({ queryKey: ['travelUserRating', travelId] });

            // Сохраняем предыдущее состояние
            const previousUserRating = queryClient.getQueryData<number | null>(['travelUserRating', travelId]);

            // Обновляем кэш оптимистично
            queryClient.setQueryData(['travelUserRating', travelId], newRating);

            return { previousUserRating };
        },
        onError: (_error, _newRating, context) => {
            // Откатываем к предыдущему состоянию
            setOptimisticRating(null);
            if (context?.previousUserRating !== undefined) {
                queryClient.setQueryData(['travelUserRating', travelId], context.previousUserRating);
            }
            showToast({
                text1: 'Не удалось сохранить оценку',
                type: 'error',
            });
        },
        onSuccess: (data) => {
            // Обновляем кэш user rating
            setOptimisticRating(null);
            queryClient.setQueryData(['travelUserRating', travelId], data.user_rating ?? null);

            // Сохраняем агрегатный рейтинг из ответа сервера
            if (typeof data.rating === 'number') setServerRating(data.rating);
            if (typeof data.rating_count === 'number') setServerCount(data.rating_count);

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
    const fetchedUserRating = userRatingQuery.data;
    const resolvedUserRating = optimisticRating ?? fetchedUserRating ?? initialUserRating;

    // Вычисляем приблизительный новый рейтинг при оптимистичном обновлении
    const baseRating = serverRating ?? initialRating ?? 0;
    const baseCount = serverCount ?? initialCount;
    const prevUserRating = fetchedUserRating ?? initialUserRating;

    const effectiveRating = optimisticRating !== null
        ? calculateNewRating(baseRating, baseCount, optimisticRating, prevUserRating)
        : baseRating;

    const effectiveCount = optimisticRating !== null && prevUserRating === null
        ? baseCount + 1
        : baseCount;

    return {
        rating: effectiveRating || initialRating,
        ratingCount: effectiveCount,
        userRating: resolvedUserRating,
        isLoading: userRatingQuery.isLoading,
        isSubmitting: rateMutation.isPending,
        canRate: isAuthenticated,
        handleRate,
        error: userRatingQuery.error || rateMutation.error,
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
