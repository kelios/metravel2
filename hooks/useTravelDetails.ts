/**
 * Кастомный хук для управления данными путешествия
 * Изолирует логику загрузки данных от UI-компонентов
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { fetchTravel, fetchTravelBySlug } from '@/src/api/travelsApi';
import type { Travel } from '@/src/types/types';

export interface UseTravelDetailsReturn {
  travel: Travel | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  slug: string;
  isId: boolean;
  isMissingParam: boolean;
}

export function useTravelDetails(): UseTravelDetailsReturn {
  const { param } = useLocalSearchParams();
  const slug = Array.isArray(param) ? param[0] : (param ?? '');
  const idNum = Number(slug);
  const isId = !Number.isNaN(idNum);
  const normalizedSlug = String(slug ?? '')
    .trim()
    .split('#')[0]
    .split('%23')[0];
  const isMissingParam = normalizedSlug.length === 0;

  const { data: travel, isLoading, isError, error, refetch } = useQuery<Travel>({
    queryKey: ['travel', normalizedSlug],
    enabled: !isMissingParam,
    queryFn: () => (isId ? fetchTravel(idNum) : fetchTravelBySlug(normalizedSlug)),
    staleTime: 600_000, // 10 минут — пока данные "свежие", повторный заход не покажет сплэш-лоадер
    gcTime: 10 * 60 * 1000,
    // Не дергаем лишние перезапросы при маунте/фокусе окна, чтобы страница не мигала
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    // Держим предыдущие данные во время фонового refetch, чтобы UI не уходил в isLoading
    placeholderData: keepPreviousData,
  });

  return {
    travel,
    isLoading,
    isError,
    error: error as Error | null,
    refetch: () => {
      refetch();
    },
    slug: normalizedSlug,
    isId,
    isMissingParam,
  };
}

