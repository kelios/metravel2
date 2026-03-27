/**
 * Кастомный хук для управления данными путешествия
 * Изолирует логику загрузки данных от UI-компонентов
 */

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { normalizeTravelItem } from '@/api/travelsNormalize';
import { fetchTravel, fetchTravelBySlug } from '@/api/travelDetailsQueries';
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

type TravelPreloadWindow = Window & typeof globalThis & {
  __metravelTravelPreload?: {
    data?: unknown;
    slug?: string;
    isId?: boolean;
  };
  __metravelTravelPreloadScriptLoaded?: boolean;
  __metravelTravelPreloadPending?: boolean;
  __metravelTravelPreloadPromise?: Promise<unknown>;
};

function hasLikelyStrippedEmbeddedMedia(description: string): boolean {
  const raw = String(description || '');
  if (!raw) return false;

  const hasEmbedMarkup =
    /<iframe\b/i.test(raw) ||
    /<blockquote\b[^>]*\binstagram-media\b/i.test(raw) ||
    /<a\b[^>]*href="https?:\/\/(?:www\.)?instagram\.com\/(?:(?:p|reel|tv)\/)[^"]+"/i.test(raw) ||
    /<a\b[^>]*href="https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtu\.be\/)[^"]+"/i.test(raw);

  if (hasEmbedMarkup) return false;

  const hasMediaLinks =
    /https?:\/\/(?:www\.)?instagram\.com\//i.test(raw) ||
    /https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(raw);

  return hasMediaLinks;
}

function hasSufficientPreloadedTravelData(travel: Travel | undefined): travel is Travel {
  if (!travel) return false;

  const travelRecord = travel as unknown as Record<string, unknown>;
  const hasIdentity =
    (typeof travel.id === 'number' && Number.isFinite(travel.id) && travel.id > 0) ||
    (typeof travel.slug === 'string' && travel.slug.trim().length > 0);
  const hasName = typeof travel.name === 'string' && travel.name.trim().length > 0;
  const hasAnyDetailField =
    Object.prototype.hasOwnProperty.call(travelRecord, 'description') ||
    Object.prototype.hasOwnProperty.call(travelRecord, 'gallery') ||
    Object.prototype.hasOwnProperty.call(travelRecord, 'travelAddress') ||
    Object.prototype.hasOwnProperty.call(travelRecord, 'coordsMeTravel');
  const hasStableDetailContract =
    Array.isArray(travel.gallery) &&
    Array.isArray(travel.travelAddress) &&
    Array.isArray(travel.coordsMeTravel);
  const hasMeaningfulDescription =
    typeof travel.description === 'string' && travel.description.replace(/<[^>]*>/g, ' ').trim().length > 0;
  const hasCorruptedEmbeddedMediaDescription =
    typeof travel.description === 'string' && hasLikelyStrippedEmbeddedMedia(travel.description);
  const gallery = Array.isArray(travel.gallery) ? travel.gallery : [];
  const travelAddress = Array.isArray(travel.travelAddress) ? travel.travelAddress : [];
  const coordsMeTravel = Array.isArray(travel.coordsMeTravel) ? travel.coordsMeTravel : [];
  const hasDetailCollections =
    gallery.length > 0 || travelAddress.length > 0 || coordsMeTravel.length > 0;
  const hasMeaningfulDetailSignal = hasMeaningfulDescription || hasDetailCollections;

  return (
    hasIdentity &&
    hasName &&
    hasAnyDetailField &&
    hasStableDetailContract &&
    hasMeaningfulDetailSignal &&
    !hasCorruptedEmbeddedMediaDescription
  );
}

/**
 * Consume preloaded travel data from the inline script in +html.tsx.
 * Returns normalized Travel if the preload matches the current slug/id, otherwise undefined.
 * The preload is consumed (deleted) on first access to avoid stale data.
 */
function consumePreloadedTravel(slug: string, isId: boolean, idNum: number): Travel | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  const win = window as TravelPreloadWindow;
  const preload = win.__metravelTravelPreload;
  if (!preload?.data) return undefined;
  const matches = isId
    ? preload.isId && String(preload.slug) === String(idNum)
    : !preload.isId && preload.slug === slug;
  if (!matches) return undefined;
  delete win.__metravelTravelPreload;
  try {
    const normalized = normalizeTravelItem(preload.data);
    return hasSufficientPreloadedTravelData(normalized) ? normalized : undefined;
  } catch {
    return undefined;
  }
}

async function waitForTravelPreload(slug: string, isId: boolean, idNum: number): Promise<Travel | undefined> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  const win = window as TravelPreloadWindow;

  const immediate = consumePreloadedTravel(slug, isId, idNum);
  if (immediate) return immediate;

  const scriptLoaded = Boolean(win.__metravelTravelPreloadScriptLoaded);
  if (scriptLoaded) {
    const bootstrapDeadline = Date.now() + 350;
    while (Date.now() < bootstrapDeadline) {
      const retry = consumePreloadedTravel(slug, isId, idNum);
      if (retry) return retry;

      const pendingBootstrap = Boolean(win.__metravelTravelPreloadPending);
      const bootstrapPromise = win.__metravelTravelPreloadPromise;
      if (pendingBootstrap || (bootstrapPromise && typeof bootstrapPromise.then === 'function')) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  const pending = Boolean(win.__metravelTravelPreloadPending);
  const promise = win.__metravelTravelPreloadPromise;
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
    if (!win.__metravelTravelPreloadPending) break;
  }

  return consumePreloadedTravel(slug, isId, idNum);
}

export function useTravelDetails(): UseTravelDetailsReturn {
  const { param } = useLocalSearchParams();
  const slug = Array.isArray(param) ? param[0] : (param ?? '');
  const idNum = Number(slug);
  const isId = Number.isFinite(idNum) && idNum > 0;
  const normalizedSlugRaw = String(slug ?? '')
    .trim()
    .split('#')[0]
    .split('%23')[0];
  const normalizedSlug = (() => {
    // expo-router may pass URL-encoded path segments on web (e.g. "%D0%BC...").
    // fetchTravelBySlug() encodes the slug again, so we decode once here to avoid double-encoding.
    if (!/%[0-9A-Fa-f]{2}/.test(normalizedSlugRaw)) return normalizedSlugRaw;
    try {
      return decodeURIComponent(normalizedSlugRaw);
    } catch {
      return normalizedSlugRaw;
    }
  })();
  const isMissingParam = normalizedSlug.length === 0;
  const cacheKey = isId ? idNum : normalizedSlug;
  const initialPreloadedTravel = useMemo(
    () => consumePreloadedTravel(normalizedSlug, isId, idNum),
    [normalizedSlug, isId, idNum]
  );
  const shouldRefetchInAutomation = isWebAutomation && !initialPreloadedTravel;

  const { data: travel, isLoading, isError, error, refetch } = useQuery<Travel>({
    queryKey: queryKeys.travel(cacheKey),
    enabled: !isMissingParam,
    initialData: initialPreloadedTravel,
    initialDataUpdatedAt: initialPreloadedTravel ? Date.now() : undefined,
    queryFn: async (context?: { signal?: AbortSignal }) => {
      const signal = context?.signal;
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
    refetchOnMount: shouldRefetchInAutomation,
    refetchOnWindowFocus: shouldRefetchInAutomation,
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
