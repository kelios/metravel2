/**
 * Кастомный хук для управления данными путешествия
 * Изолирует логику загрузки данных от UI-компонентов
 */

import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { fetchTravel, fetchTravelBySlug } from '@/src/api/travels';
import type { Travel } from '@/src/types/types';

export interface UseTravelDetailsReturn {
  travel: Travel | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  slug: string;
  isId: boolean;
}

export function useTravelDetails(): UseTravelDetailsReturn {
  const { param } = useLocalSearchParams();
  const slug = Array.isArray(param) ? param[0] : (param ?? '');
  const idNum = Number(slug);
  const isId = !Number.isNaN(idNum);

  const { data: travel, isLoading, isError, error, refetch } = useQuery<Travel>({
    queryKey: ['travel', slug],
    queryFn: () => (isId ? fetchTravel(idNum) : fetchTravelBySlug(slug)),
    staleTime: 600_000, // 10 минут
    gcTime: 10 * 60 * 1000,
  });

  return {
    travel,
    isLoading,
    isError,
    error: error as Error | null,
    refetch: () => {
      refetch();
    },
    slug,
    isId,
  };
}

