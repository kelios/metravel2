/**
 * Кастомный хук для управления данными путешествия
 * Изолирует логику загрузки данных от UI-компонентов
 */

import { useCallback, useEffect, useMemo } from 'react';
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
    source?: string;
  };
  __metravelTravelPreloadScriptLoaded?: boolean;
  __metravelTravelPreloadPending?: boolean;
  __metravelTravelPreloadPromise?: Promise<unknown>;
  __metravelTravelPreloadTargetPath?: string;
};

// The inline preload bootstrap (app/+html.tsx) runs once, only for the initial
// document URL, and records the path it targeted in __metravelTravelPreloadTargetPath.
// SPA navigations never re-run it, so this global keeps pointing at the first
// page — which is exactly how we tell "initial direct load of this travel" apart
// from "in-app navigation to a different travel" (where no preload is in flight).
function isInitialPreloadTarget(normalizedSlug: string, isId: boolean, idNum: number): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const targetPath = (window as TravelPreloadWindow).__metravelTravelPreloadTargetPath;
  if (typeof targetPath !== 'string' || !targetPath) return false;
  const match = targetPath.match(/^\/travels\/([^/?#]+)/);
  if (!match) return false;
  let segment = match[1];
  if (/%[0-9A-Fa-f]{2}/.test(segment)) {
    try {
      segment = decodeURIComponent(segment);
    } catch {
      // keep raw segment on malformed encoding
    }
  }
  return isId ? String(segment) === String(idNum) : segment === normalizedSlug;
}

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

function hasMinimumPreloadedTravelIdentity(travel: Travel | undefined): travel is Travel {
  if (!travel) return false;
  const hasIdentity =
    (typeof travel.id === 'number' && Number.isFinite(travel.id) && travel.id > 0) ||
    (typeof travel.slug === 'string' && travel.slug.trim().length > 0);
  const hasName = typeof travel.name === 'string' && travel.name.trim().length > 0;
  return hasIdentity && hasName;
}

/**
 * Consume preloaded travel data from the inline script in +html.tsx.
 * Returns normalized Travel if the preload matches the current slug/id.
 * Render-time initialData uses a non-consuming read so concurrent render retries
 * cannot delete the bootstrap payload before React Query commits it.
 */
export function consumePreloadedTravel(
  slug: string,
  isId: boolean,
  idNum: number,
  options: { allowDirectApiIncomplete?: boolean; consume?: boolean } = {},
): Travel | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  const win = window as TravelPreloadWindow;
  const preload = win.__metravelTravelPreload;
  if (!preload?.data) return undefined;
  const matches = isId
    ? preload.isId && String(preload.slug) === String(idNum)
    : !preload.isId && preload.slug === slug;
  if (!matches) return undefined;
  try {
    const normalized = normalizeTravelItem(preload.data);
    const shouldKeepDirectApiPreload =
      options.allowDirectApiIncomplete && preload.source === 'direct-api';
    if (!hasSufficientPreloadedTravelData(normalized)) {
      if (
        options.allowDirectApiIncomplete &&
        preload.source === 'direct-api' &&
        hasMinimumPreloadedTravelIdentity(normalized)
      ) {
        if (options.consume !== false && !shouldKeepDirectApiPreload) delete win.__metravelTravelPreload;
        return normalized;
      }
      if (options.consume !== false) delete win.__metravelTravelPreload;
      return undefined;
    }
    if (options.consume !== false && !shouldKeepDirectApiPreload) delete win.__metravelTravelPreload;
    return normalized;
  } catch {
    if (options.consume !== false) delete win.__metravelTravelPreload;
    return undefined;
  }
}

async function waitForTravelPreload(
  slug: string,
  isId: boolean,
  idNum: number,
  options: { skipPolling?: boolean } = {},
): Promise<Travel | undefined> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  const win = window as TravelPreloadWindow;
  const consumeForQuery = () => consumePreloadedTravel(slug, isId, idNum, {
    allowDirectApiIncomplete: true,
  });

  const immediate = consumeForQuery();
  if (immediate) return immediate;

  // The hook read a sufficient preload synchronously at setup time (initialData).
  // Either React Query already committed it, or the render-time effect consumed it.
  // Re-entering the polling/Promise.race wait here cannot recover anything new for
  // this slug — it would only add dead time before falling back to fetch. Skip it.
  if (options.skipPolling) return undefined;

  // On a client-side SPA navigation the preload bootstrap (app/+html.tsx) never
  // re-runs — it only ever targets the initial document URL, and the global
  // __metravelTravelPreloadScriptLoaded flag stays sticky-true after that first
  // load. That defeats the bail-out below (it requires !scriptLoaded), so every
  // in-app navigation used to block on the *stale* preload promise from the
  // first page. On slow networks that dead time ate into the request timeout and
  // surfaced as a stuck/blank or "не удалось загрузить" article page. If the slug
  // we're resolving now isn't the initially preloaded one, there is nothing to
  // wait for — fetch immediately.
  if (!isInitialPreloadTarget(slug, isId, idNum)) {
    return undefined;
  }

  let scriptLoaded = Boolean(win.__metravelTravelPreloadScriptLoaded);
  // The preload script is appended only during the initial direct load of a
  // /travels/* URL (and sets __metravelTravelPreloadScriptLoaded synchronously
  // before React hydrates). On a client-side SPA navigation (from search,
  // collections, etc.) it never runs, so there is nothing to wait for. Bailing
  // out here avoids a wasteful ~1s block on every in-app navigation — that dead
  // time previously pushed slow networks toward the request timeout and produced
  // a sticky "не удалось загрузить" error that only a full reload could clear.
  if (
    !scriptLoaded &&
    !win.__metravelTravelPreloadPending &&
    !win.__metravelTravelPreloadPromise
  ) {
    return undefined;
  }

  if (!scriptLoaded) {
    const scriptDeadline = Date.now() + 1000;
    while (Date.now() < scriptDeadline) {
      scriptLoaded = Boolean(win.__metravelTravelPreloadScriptLoaded);
      if (scriptLoaded || win.__metravelTravelPreloadPending || win.__metravelTravelPreloadPromise) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  if (scriptLoaded) {
    const bootstrapDeadline = Date.now() + 350;
    while (Date.now() < bootstrapDeadline) {
      const retry = consumeForQuery();
      if (retry) return retry;

      const pendingBootstrap = Boolean(win.__metravelTravelPreloadPending);
      const bootstrapPromise = win.__metravelTravelPreloadPromise;
      if (pendingBootstrap || (bootstrapPromise && typeof bootstrapPromise.then === 'function')) {
        const promiseTimeoutMs = 1000;
        try {
          await Promise.race([
            bootstrapPromise,
            new Promise((resolve) => setTimeout(resolve, promiseTimeoutMs)),
          ]);
        } catch {
          // noop
        }
        return consumeForQuery();
      }

      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  const pending = Boolean(win.__metravelTravelPreloadPending);
  const promise = win.__metravelTravelPreloadPromise;
  if (!pending && !promise) return undefined;

  const timeoutMs = 1000;
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
    return consumeForQuery();
  }

  while (Date.now() - start < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    const retry = consumeForQuery();
    if (retry) return retry;
    if (!win.__metravelTravelPreloadPending) break;
  }

  return consumeForQuery();
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
    () => consumePreloadedTravel(normalizedSlug, isId, idNum, { consume: false }),
    [normalizedSlug, isId, idNum]
  );
  useEffect(() => {
    if (!initialPreloadedTravel) return;
    const timeoutId = setTimeout(() => {
      consumePreloadedTravel(normalizedSlug, isId, idNum);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [initialPreloadedTravel, normalizedSlug, isId, idNum]);
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
      // When a sufficient preload was already available synchronously (initialData),
      // skip the polling wait entirely: if this queryFn still runs, the preload is
      // either committed or consumed, so waiting again is pure dead time.
      const preloaded = await waitForTravelPreload(normalizedSlug, isId, idNum, {
        skipPolling: Boolean(initialPreloadedTravel),
      });
      if (preloaded) return preloaded;

      return isId
        ? fetchTravel(idNum, { signal })
        : fetchTravelBySlug(normalizedSlug, { signal });
    },
    // Travel page is a core landing route. On the initial direct load the data
    // comes from the preload bootstrap (initialData), so a network retry never
    // blocks LCP there. On a client-side SPA navigation there is no preload
    // safety net, and a single transient failure with retry:false turned into a
    // sticky error (staleTime kept it from refetching) that only a full reload
    // could clear. Retry transient (non-404) failures a couple of times so the
    // SPA path self-heals; genuine 404s fail fast (slug fallback already ran).
    retry: Platform.OS === 'web'
      ? (failureCount: number, err: unknown) => {
          if (failureCount >= 2) return false;
          const status = Number(
            (err as { status?: unknown } | null)?.status ??
              (err as { response?: { status?: unknown } } | null)?.response?.status,
          );
          if (status === 404) return false;
          const message = err instanceof Error ? err.message : String(err ?? '');
          if (/\b404\b|not found|не найден|не существует|удалено/i.test(message)) return false;
          return true;
        }
      : undefined,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 4000),
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
