// hooks/usePlaceRating.ts
// Хук управления собственным (MeTravel) рейтингом места. Зеркалит
// hooks/useArticleRating.ts: агрегат + оценка пользователя одним запросом,
// оптимистичное обновление, тост об успехе/ошибке, гейт авторизации.

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ratePlace, getPlaceRating, type PlaceRatingResponse } from '@/api/placeRating';
import { queryKeys } from '@/api/queryKeys';
import { useAuth } from '@/context/AuthContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { showToast } from '@/utils/toast';
import { calculateNewRating } from '@/utils/ratingHelpers';
import { translate as i18nT } from '@/i18n';

type UsePlaceRatingOptions = {
  placeId: string | number | undefined;
  initialRating?: number | null;
  initialCount?: number;
  initialUserRating?: number | null;
  enabled?: boolean;
};

type UsePlaceRatingReturn = {
  rating: number | null;
  ratingCount: number;
  userRating: number | null;
  isLoading: boolean;
  isSubmitting: boolean;
  canRate: boolean;
  handleRate: (value: number) => void;
  error: Error | null;
};

export function usePlaceRating({
  placeId,
  initialRating = null,
  initialCount = 0,
  initialUserRating = null,
  enabled = true,
}: UsePlaceRatingOptions): UsePlaceRatingReturn {
  const { isAuthenticated } = useAuth();
  const { requireAuth } = useRequireAuth({ intent: 'rate' });
  const queryClient = useQueryClient();

  const [optimisticRating, setOptimisticRating] = useState<number | null>(null);

  // Только для авторизованных: чтобы получить user_rating (оценку текущего юзера).
  const ratingQuery = useQuery({
    queryKey: queryKeys.placeRating(placeId, isAuthenticated),
    queryFn: () => getPlaceRating(placeId!),
    enabled: enabled && placeId != null && isAuthenticated,
    staleTime: 30 * 1000,
    placeholderData: (initialRating != null || initialUserRating != null)
      ? {
          rating: initialRating ?? 0,
          rating_count: initialCount,
          user_rating: initialUserRating ?? null,
        }
      : undefined,
  });

  const rateMutation = useMutation({
    mutationFn: (rating: number) => ratePlace({ placeId: placeId!, rating }),
    onMutate: async (newRating) => {
      setOptimisticRating(newRating);
      await queryClient.cancelQueries({ queryKey: queryKeys.placeRating(placeId, isAuthenticated) });
      const previousData = queryClient.getQueryData<PlaceRatingResponse>(
        queryKeys.placeRating(placeId, isAuthenticated),
      );
      return { previousData };
    },
    onError: (_error, _newRating, context) => {
      setOptimisticRating(null);
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.placeRating(placeId, isAuthenticated), context.previousData);
      }
      showToast({
        text1: i18nT('shared:hooks.usePlaceRating.ne_udalos_sohranit_otsenku_04aaa4f0'),
        type: 'error',
      });
    },
    onSuccess: (data) => {
      setOptimisticRating(null);
      queryClient.setQueryData(queryKeys.placeRating(placeId, isAuthenticated), data);
      showToast({
        text1: i18nT('shared:hooks.usePlaceRating.otsenka_sohranena_67bda0e0'),
        type: 'success',
      });
    },
  });

  const handleRate = useCallback((value: number) => {
    if (placeId == null) return;
    if (!isAuthenticated) {
      requireAuth();
      return;
    }
    rateMutation.mutate(value);
  }, [placeId, isAuthenticated, requireAuth, rateMutation]);

  const currentData = ratingQuery.data;
  const effectiveUserRating = optimisticRating ?? currentData?.user_rating ?? initialUserRating;

  const effectiveRating = optimisticRating !== null && currentData
    ? calculateNewRating(
        currentData.rating,
        currentData.rating_count,
        optimisticRating,
        currentData.user_rating,
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

export default usePlaceRating;
