/**
 * Hook для prefetching данных путешествий
 * Улучшает UX за счет предзагрузки данных
 */

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { fetchTravel, fetchTravelBySlug } from '@/src/api/travelsApi';
import type { Travel } from '@/src/types/types';

export function useTravelPrefetch() {
  const queryClient = useQueryClient();

  const prefetchBySlug = useCallback(
    (slug: string) => {
      return queryClient.prefetchQuery({
        queryKey: ['travel', slug],
        queryFn: () => fetchTravelBySlug(slug),
        staleTime: 10 * 60 * 1000, // 10 минут
      });
    },
    [queryClient]
  );

  const prefetchById = useCallback(
    (id: number) => {
      return queryClient.prefetchQuery({
        queryKey: ['travel', id],
        queryFn: () => fetchTravel(id),
        staleTime: 10 * 60 * 1000,
      });
    },
    [queryClient]
  );

  const prefetchMultiple = useCallback(
    (travels: Array<{ id?: number; slug?: string }>) => {
      return Promise.all(
        travels.map((travel) => {
          if (travel.slug) {
            return prefetchBySlug(travel.slug);
          }
          if (travel.id) {
            return prefetchById(travel.id);
          }
          return Promise.resolve();
        })
      );
    },
    [prefetchBySlug, prefetchById]
  );

  const getCachedTravel = useCallback(
    (slugOrId: string | number): Travel | undefined => {
      return queryClient.getQueryData(['travel', slugOrId]);
    },
    [queryClient]
  );

  return {
    prefetchBySlug,
    prefetchById,
    prefetchMultiple,
    getCachedTravel,
  };
}
