/**
 * Кастомный хук для управления данными путешествия
 * Изолирует логику загрузки данных от UI-компонентов
 */

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { fetchTravel, fetchTravelBySlug, normalizeTravelItem } from '@/api/travelsApi';
import type { Travel } from '@/types/types';
import { Platform } from 'react-native';
import { queryKeys } from '@/queryKeys';
import { isWebAutomation } from '@/utils/isWebAutomation';

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

async function waitForTravelPreload(slug: string, isId: boolean, idNum: number): Promise<Travel | undefined> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;

  const immediate = consumePreloadedTravel(slug, isId, idNum);
  if (immediate) return immediate;

  const pending = Boolean((window as any).__metravelTravelPreloadPending);
  const promise: Promise<any> | undefined = (window as any).__metravelTravelPreloadPromise;
  if (!pending && !promise) return undefined;

  const timeoutMs = 2500;
  const start = Date.now();

  if (promise && typeof promise.then === 'function') {
    try {
      await Promise.race([
        promise,
        new Promise((resolve) => setTimeout(resolve, timeoutMs)),
      ]);
    } catch {
      // noop
    }
    return consumePreloadedTravel(slug, isId, idNum);
  }

  while (Date.now() - start < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    const retry = consumePreloadedTravel(slug, isId, idNum);
    if (retry) return retry;
    if (!(window as any).__metravelTravelPreloadPending) break;
  }

  return consumePreloadedTravel(slug, isId, idNum);
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
  const initialPreloadedTravel = useMemo(
    () => consumePreloadedTravel(normalizedSlug, isId, idNum),
    [normalizedSlug, isId, idNum]
  );

  const { data: travel, isLoading, isError, error, refetch } = useQuery<Travel>({
    queryKey: queryKeys.travel(cacheKey),
    enabled: !isMissingParam,
    initialData: initialPreloadedTravel,
    initialDataUpdatedAt: initialPreloadedTravel ? Date.now() : undefined,
    queryFn: async ({ signal } = {} as any) => {
      // Try to reuse preload from +html.tsx and wait shortly for its in-flight request.
      // This avoids duplicate travel-details fetches on first paint (critical for LCP).
      const preloaded = await waitForTravelPreload(normalizedSlug, isId, idNum);
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

  const stableRefetch = useCallback(() => {
    refetch();
  }, [refetch]);

  return useMemo(() => ({
    travel,
    isLoading,
    isError,
    error: error as Error | null,
    refetch: stableRefetch,
    slug: normalizedSlug,
    isId,
    isMissingParam,
  }), [
    travel,
    isLoading,
    isError,
    error,
    stableRefetch,
    normalizedSlug,
    isId,
    isMissingParam,
  ]);
}
