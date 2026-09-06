/**
 * Кастомный хук для управления данными путешествия
 * Изолирует логику загрузки данных от UI-компонентов
 */

import { useCallback, useEffect, useMemo } from 'react';
import { onlineManager, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { normalizeTravelItem } from '@/api/travelsNormalize';
import { fetchTravel, fetchTravelBySlug } from '@/api/travelDetailsQueries';
import { isTimeoutError } from '@/api/client';
import type { Travel } from '@/types/types';
import { Platform } from 'react-native';
import { queryKeys } from '@/queryKeys';
import { isWebAutomation } from '@/utils/isWebAutomation';
import {
  getPublicStalePayloadMeta,
  type PublicStalePayloadMeta,
} from '@/utils/publicStaleCache';
import { loadTravelOfflineAdapter } from '@/services/offline/loadTravelOfflineAdapter';
import { normalizeTravelRouteSegment } from '@/utils/travelRouteSegment';

export interface UseTravelDetailsReturn {
  travel: Travel | undefined;
  hasInitialPreloadedTravel: boolean;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  slug: string;
  isId: boolean;
  isMissingParam: boolean;
  staleContentMeta: PublicStalePayloadMeta | null;
}

type TravelPreloadWindow = Window & typeof globalThis & {
  __metravelTravelPreload?: {
    data?: unknown;
    slug?: string;
    isId?: boolean;
    source?: string;
    // #1479: the SSG inline preload ships only `media.cover`; the full media
    // manifest (gallery/address/body) is dropped to shrink the document and
    // free bandwidth for the hero LCP. When true, the runtime must still treat
    // the preload as sufficient for first paint but force one background
    // refetch to backfill the full media.
    mediaPartial?: boolean;
  };
  __metravelTravelPreloadScriptLoaded?: boolean;
  __metravelTravelPreloadPending?: boolean;
  __metravelTravelPreloadPromise?: Promise<unknown>;
  __metravelTravelPreloadTargetPath?: string;
};

const PRELOAD_WAIT_TIMEOUT_MS = 500;
const PRELOAD_BOOTSTRAP_READY_TIMEOUT_MS = 350;
const PRELOAD_POLL_INTERVAL_MS = 25;

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
    const scriptDeadline = Date.now() + PRELOAD_WAIT_TIMEOUT_MS;
    while (Date.now() < scriptDeadline) {
      scriptLoaded = Boolean(win.__metravelTravelPreloadScriptLoaded);
      if (scriptLoaded || win.__metravelTravelPreloadPending || win.__metravelTravelPreloadPromise) break;
      await new Promise((resolve) => setTimeout(resolve, PRELOAD_POLL_INTERVAL_MS));
    }
  }

  if (scriptLoaded) {
    const bootstrapDeadline = Date.now() + PRELOAD_BOOTSTRAP_READY_TIMEOUT_MS;
    while (Date.now() < bootstrapDeadline) {
      const retry = consumeForQuery();
      if (retry) return retry;

      const pendingBootstrap = Boolean(win.__metravelTravelPreloadPending);
      const bootstrapPromise = win.__metravelTravelPreloadPromise;
      if (pendingBootstrap || (bootstrapPromise && typeof bootstrapPromise.then === 'function')) {
        try {
          await Promise.race([
            bootstrapPromise,
            new Promise((resolve) => setTimeout(resolve, PRELOAD_WAIT_TIMEOUT_MS)),
          ]);
        } catch {
          // noop
        }
        return consumeForQuery();
      }

      await new Promise((resolve) => setTimeout(resolve, PRELOAD_POLL_INTERVAL_MS));
    }
  }

  const pending = Boolean(win.__metravelTravelPreloadPending);
  const promise = win.__metravelTravelPreloadPromise;
  if (!pending && !promise) return undefined;

  const start = Date.now();

  if (promise && typeof promise.then === 'function') {
    try {
      await Promise.race([
        promise,
        new Promise((resolve) => setTimeout(resolve, PRELOAD_WAIT_TIMEOUT_MS)),
      ]);
    } catch {
      // noop
    }
    return consumeForQuery();
  }

  while (Date.now() - start < PRELOAD_WAIT_TIMEOUT_MS) {
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
  // #1801: нормализация вынесена в общий хелпер — тот же код обязан считать
  // сегмент и в крошках, иначе у одного маршрута получаются разные ключи.
  const normalizedSlug = normalizeTravelRouteSegment(slug);
  const isMissingParam = normalizedSlug.length === 0;
  const cacheKey = isId ? idNum : normalizedSlug;
  const initialPreloadedTravel = useMemo(
    () => consumePreloadedTravel(normalizedSlug, isId, idNum, { consume: false }),
    [normalizedSlug, isId, idNum]
  );
  // #1479: The SSG inline preload for this slug carries only `media.cover`; the
  // full manifest is fetched in the background. Detect that partial state here
  // (during the initial render, before the consume effect deletes the global)
  // so first paint still hydrates from the preload while the query is told to
  // backfill the full media once on mount.
  const preloadMediaPartial = useMemo(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
    const preload = (window as TravelPreloadWindow).__metravelTravelPreload;
    if (!preload?.mediaPartial) return false;
    const matches = isId
      ? preload.isId && String(preload.slug) === String(idNum)
      : !preload.isId && preload.slug === normalizedSlug;
    return Boolean(matches);
  }, [normalizedSlug, isId, idNum]);
  useEffect(() => {
    if (!initialPreloadedTravel) return;
    const timeoutId = setTimeout(() => {
      consumePreloadedTravel(normalizedSlug, isId, idNum);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [initialPreloadedTravel, normalizedSlug, isId, idNum]);
  const shouldRefetchInAutomation = isWebAutomation && !initialPreloadedTravel;

  const {
    data: travel,
    isLoading,
    isError: queryIsError,
    error: queryError,
    refetch,
  } = useQuery<Travel>({
    queryKey: queryKeys.travel(cacheKey),
    enabled: !isMissingParam,
    initialData: initialPreloadedTravel,
    initialDataUpdatedAt: initialPreloadedTravel ? Date.now() : undefined,
    queryFn: async (context?: { signal?: AbortSignal }) => {
      const signal = context?.signal;
      if (!onlineManager.isOnline()) {
        // #1552: онлайн-открытие статьи не должно загружать санитайзер и
        // хранилище офлайн-копий. Контракт queryFn уже async, поэтому адаптер
        // разрешается только в реально выбранной офлайн-ветке.
        const { readTravelOffline } = await loadTravelOfflineAdapter();
        const cached = await readTravelOffline(cacheKey);
        if (cached) return cached;
        throw new Error('OFFLINE_CONTENT_NOT_SAVED');
      }
      // Try to reuse preload from +html.tsx and wait shortly for its in-flight request.
      // This avoids duplicate travel-details fetches on first paint (critical for LCP).
      // When a sufficient preload was already available synchronously (initialData),
      // skip the polling wait entirely: if this queryFn still runs, the preload is
      // either committed or consumed, so waiting again is pure dead time.
      // #1479: A partial-media preload (only `media.cover`) intentionally skips
      // preload reuse here so the background mount refetch reaches the network
      // and backfills the full media manifest (gallery/address/body).
      if (!preloadMediaPartial) {
        const preloaded = await waitForTravelPreload(normalizedSlug, isId, idNum, {
          skipPolling: Boolean(initialPreloadedTravel),
        });
        if (preloaded) return preloaded;
      }

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
    retry: !onlineManager.isOnline()
      ? false
      : Platform.OS === 'web'
      ? (failureCount: number, err: unknown) => {
          if (failureCount >= 2) return false;
          const status = Number(
            (err as { status?: unknown } | null)?.status ??
              (err as { response?: { status?: unknown } } | null)?.response?.status,
          );
          if (status === 404) return false;
          // Таймаут уже отъел 10с; повтор зависшего бэка лишь утраивает
          // полноэкранный скелет. Connection-блипы (Failed to fetch) — ретраим.
          if (isTimeoutError(err)) return false;
          const message = err instanceof Error ? err.message : String(err ?? '');
          if (/\b404\b|not found|не найден|не существует|удалено/i.test(message)) return false;
          return true;
        }
      : undefined,
    // This query owns a durable local source and must run its queryFn while
    // offline; the function above never touches the network in that state.
    networkMode: 'always',
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 4000),
    staleTime: 600_000, // 10 минут — пока данные "свежие", повторный заход не покажет сплэш-лоадер
    gcTime: 10 * 60 * 1000,
    // Не дергаем лишние перезапросы при маунте/фокусе окна, чтобы страница не мигала.
    // #1479: но когда preload media частичный (только `media.cover`), нужен ровно
    // один фоновый refetch на маунте, чтобы догрузить полный манифест галереи/
    // точек/тела статьи. 'always' гидратирует hero из initialData мгновенно и
    // качает полный payload в фоне, не мигая контентом.
    refetchOnMount: preloadMediaPartial ? 'always' : shouldRefetchInAutomation,
    refetchOnWindowFocus: shouldRefetchInAutomation,
    // keepPreviousData removed: it caused showing the PREVIOUS travel's gallery/content
    // when navigating between different travels, producing a visible flicker
    // (old gallery flash → skeleton → new content).
    placeholderData: undefined,
  });

  const stableRefetch = useCallback(() => {
    refetch();
  }, [refetch]);
  // A failed partial-media backfill must not replace the already-renderable SSG
  // article with the full-page load error. The trimmed payload keeps legacy URL
  // fallbacks for below-fold media, so that path is fatal only with no usable
  // preload; all other query paths retain their existing error semantics.
  const isError = queryIsError && !(preloadMediaPartial && travel);
  const error = isError ? queryError : null;
  const staleContentMeta = useMemo(() => getPublicStalePayloadMeta(travel), [travel]);

  return useMemo(() => ({
    travel,
    hasInitialPreloadedTravel: Boolean(initialPreloadedTravel),
    isLoading,
    isError,
    error: error as Error | null,
    refetch: stableRefetch,
    slug: normalizedSlug,
    isId,
    isMissingParam,
    staleContentMeta,
  }), [
    travel,
    initialPreloadedTravel,
    isLoading,
    isError,
    error,
    stableRefetch,
    normalizedSlug,
    isId,
    isMissingParam,
    staleContentMeta,
  ]);
}
