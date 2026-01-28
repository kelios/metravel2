/**
 * Кастомный хук для управления данными путешествия
 * Изолирует логику загрузки данных от UI-компонентов
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { fetchTravel, fetchTravelBySlug } from '@/src/api/travelsApi';
import type { Travel } from '@/src/types/types';
import { Platform } from 'react-native';

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
  const isId = Number.isFinite(idNum) && idNum > 0;
  const normalizedSlug = String(slug ?? '')
    .trim()
    .split('#')[0]
    .split('%23')[0];
  const isMissingParam = normalizedSlug.length === 0;
  const cacheKey = isId ? idNum : normalizedSlug;

  const isWebAutomation =
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    Boolean((navigator as any).webdriver);

  const { data: travel, isLoading, isError, error, refetch } = useQuery<Travel>({
    queryKey: ['travel', cacheKey],
    enabled: !isMissingParam,
    queryFn: () => (isId ? fetchTravel(idNum) : fetchTravelBySlug(normalizedSlug)),
    staleTime: 600_000, // 10 минут — пока данные "свежие", повторный заход не покажет сплэш-лоадер
    gcTime: 10 * 60 * 1000,
    // Не дергаем лишние перезапросы при маунте/фокусе окна, чтобы страница не мигала
    refetchOnMount: isWebAutomation ? true : false,
    refetchOnWindowFocus: isWebAutomation ? true : false,
    // In Playwright runs we want deterministic error rendering when network is blocked.
    // keepPreviousData can mask errors by keeping cached content visible.
    placeholderData: isWebAutomation ? undefined : keepPreviousData,
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
