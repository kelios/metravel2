import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { fetchTravel, fetchTravelBySlug } from '@/src/api/travelsApi';

/**
 * Хук для предзагрузки данных путешествий
 * Полезен для улучшения UX при наведении на карточки
 * 
 * @example
 * const { prefetchTravel } = usePrefetch();
 * 
 * <Pressable
 *   onMouseEnter={() => prefetchTravel(travel.id)}
 *   onPress={() => router.push(`/travels/${travel.id}`)}
 * >
 */
export function usePrefetch() {
  const queryClient = useQueryClient();

  const prefetchTravel = useCallback(
    (id: number | string) => {
      const isNumeric = typeof id === 'number' || !isNaN(Number(id));
      
      queryClient.prefetchQuery({
        queryKey: ['travel', id],
        queryFn: () =>
          isNumeric
            ? fetchTravel(Number(id))
            : fetchTravelBySlug(String(id)),
        staleTime: 5 * 60 * 1000, // 5 минут
      });
    },
    [queryClient]
  );

  const prefetchTravels = useCallback(
    (ids: (number | string)[]) => {
      ids.forEach((id) => prefetchTravel(id));
    },
    [prefetchTravel]
  );

  return {
    prefetchTravel,
    prefetchTravels,
  };
}

