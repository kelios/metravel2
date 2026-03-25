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

const parseFiniteNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
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
            const previousAggregateRating = serverRating ?? initialRating ?? 0;
            const previousAggregateCount = serverCount ?? initialCount;

            // Обновляем кэш оптимистично
            queryClient.setQueryData(['travelUserRating', travelId], newRating);

            return {
                previousUserRating,
                previousAggregateRating,
                previousAggregateCount,
            };
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
        onSuccess: (data, submittedRating, context) => {
            const nextUserRating = parseFiniteNumber(data.user_rating) ?? submittedRating;
            const fallbackRating = calculateNewRating(
                context?.previousAggregateRating ?? (serverRating ?? initialRating ?? 0),
                context?.previousAggregateCount ?? (serverCount ?? initialCount),
                nextUserRating,
                context?.previousUserRating ?? initialUserRating ?? null
            );
            const fallbackCount =
                (context?.previousUserRating ?? initialUserRating ?? null) == null ||
                (context?.previousUserRating ?? initialUserRating ?? null) === 0
                    ? (context?.previousAggregateCount ?? (serverCount ?? initialCount)) + 1
                    : (context?.previousAggregateCount ?? (serverCount ?? initialCount));
            const nextAggregateRating = parseFiniteNumber(data.rating) ?? fallbackRating;
            const nextAggregateCount = parseFiniteNumber(data.rating_count) ?? fallbackCount;

            // Обновляем кэш user rating
            setOptimisticRating(null);
            queryClient.setQueryData(['travelUserRating', travelId], nextUserRating);

            // Сохраняем агрегатный рейтинг из ответа сервера
            setServerRating(nextAggregateRating);
            setServerCount(nextAggregateCount);

            queryClient.setQueriesData({ queryKey: ['travel'] }, (current) => {
                if (!current || typeof current !== 'object') return current;

                const currentTravel = current as Record<string, unknown>;
                const currentId = parseFiniteNumber(currentTravel.id);
                if (currentId !== travelId) return current;

                return {
                    ...currentTravel,
                    rating: nextAggregateRating,
                    rating_count: nextAggregateCount,
                    user_rating: nextUserRating,
                };
            });

            // Инвалидируем travel-кэш без exact matching: детальная страница может быть закэширована по slug.
            queryClient.invalidateQueries({ queryKey: ['travel'] });
            // Сохраняем старое поведение для id-ключа на случай прямого входа по id.
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
