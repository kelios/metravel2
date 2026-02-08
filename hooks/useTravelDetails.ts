/**
 * Кастомный хук для управления данными путешествия
 * Изолирует логику загрузки данных от UI-компонентов
 */

import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { fetchTravel, fetchTravelBySlug, normalizeTravelItem } from '@/api/travelsApi';
import type { Travel } from '@/types/types';
import { Platform } from 'react-native';
import { queryKeys } from '@/queryKeys';

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

/**
 * Consume preloaded travel data from the inline script in +html.tsx.
 * Returns normalized Travel if the preload matches the current slug/id, otherwise undefined.
 * The preload is consumed (deleted) on first access to avoid stale data.
 */
function consumePreloadedTravel(slug: string, isId: boolean, idNum: number): Travel | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  const preload = (window as any).__metravelTravelPreload;
  if (!preload?.data) return undefined;
  const matches = isId
    ? preload.isId && String(preload.slug) === String(idNum)
    : !preload.isId && preload.slug === slug;
  if (!matches) return undefined;
  delete (window as any).__metravelTravelPreload;
  try {
    return normalizeTravelItem(preload.data);
  } catch {
    return undefined;
  }
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
    queryKey: queryKeys.travel(cacheKey),
    enabled: !isMissingParam,
    queryFn: ({ signal } = {} as any) => {
      // Try to consume preloaded data from the inline script (avoids double API fetch)
      const preloaded = consumePreloadedTravel(normalizedSlug, isId, idNum);
      if (preloaded) return preloaded;
      return isId
        ? fetchTravel(idNum, { signal })
        : fetchTravelBySlug(normalizedSlug, { signal });
    },
    // Travel page is a core landing route; retries can keep the UI in "loading"
    // for a long time when API is misconfigured/unreachable (hurts LCP).
    retry: Platform.OS === 'web' ? false : undefined,
    staleTime: 600_000, // 10 минут — пока данные "свежие", повторный заход не покажет сплэш-лоадер
    gcTime: 10 * 60 * 1000,
    // Не дергаем лишние перезапросы при маунте/фокусе окна, чтобы страница не мигала
    refetchOnMount: isWebAutomation ? true : false,
    refetchOnWindowFocus: isWebAutomation ? true : false,
    // keepPreviousData removed: it caused showing the PREVIOUS travel's gallery/content
    // when navigating between different travels, producing a visible flicker
    // (old gallery flash → skeleton → new content).
    placeholderData: undefined,
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
