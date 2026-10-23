import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import { blockHiddenCount, servedPageLength } from '@/api/blockSensitiveShapes';
import { useQueryOwner } from '@/hooks/useQueryOwner';
import { useAuthStore } from '@/stores/authStore';
import { deleteTravel, fetchMyTravels, unwrapMyTravelsPayload } from '@/api/travelsApi';
import type { Travel } from '@/types/types';
import { normalizeToTravel } from '@/components/profile/travelNormalize';
import { confirmAction } from '@/utils/confirmAction';
import type { TravelEngagementStats } from '@/utils/travelEngagementStats'
import { showToastMessage } from '@/utils/toast'
import { translate as i18nT } from '@/i18n'
import { isOfflineLikeError, isTimeoutError } from '@/api/clientErrors'
import { DRAFT_PUBLICATION_STATUSES, isTravelDraft } from '@/utils/travelPublicationStatus'


interface UseMyTravelsArgs {
  userId?: string | null;
  perPage: number;
  includeDrafts?: boolean;
  /**
   * Серверный фильтр по статусу публикации (`where.publication_status`).
   * Задан — список приходит уже отфильтрованным; разбивку вкладок такой
   * экземпляр не считает, она принадлежит общему списку автора.
   */
  publicationStatus?: readonly string[];
  /**
   * Общее число маршрутов автора. `null` — счётчик потерян сбоем запроса: это
   * не ноль, и потребитель обязан отличать его от «маршрутов нет» (#1871).
   */
  onTotalChange?: (total: number | null) => void;
}

export interface TravelPublicationCounts {
  published: number;
  drafts: number;
}

export interface UseMyTravelsResult {
  myTravels: Travel[];
  engagementSummary: TravelEngagementStats | null;
  /**
   * Сколько у автора опубликованных и черновиков ВСЕГО, а не в загруженных
   * страницах. null — разбивка недоступна; какой именно случай, говорит
   * `publicationCountsUnavailable`.
   */
  publicationCounts: TravelPublicationCounts | null;
  /**
   * true — запрос за разбивкой упал либо клиентская блокировка сделала
   * неполный серверный снимок несогласованным. Отделяет от «ещё не загружено»:
   * оба состояния дают `publicationCounts === null`, но сбой обязан показывать
   * «—», а не прятать счётчик (#1871).
   */
  publicationCountsUnavailable: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  removingTravelId: number | null;
  hasMore: boolean;
  /** Текст ошибки первой страницы. null — данные актуальны либо ещё грузятся. */
  error: string | null;
  load: () => Promise<void>;
  loadMore: () => Promise<void>;
  /** true — маршрут удалён (или его уже не было на сервере). false — отмена или сбой. */
  remove: (travelId: number) => Promise<boolean>;
}

const toDecrementedMetric = (current: number | null | undefined, delta: number | null | undefined) => {
  if (current == null) return current ?? null
  return Math.max(0, current - (delta ?? 0))
}

const decrementSummaryByTravel = (
  current: TravelEngagementStats | null,
  travel: Travel | undefined
): TravelEngagementStats | null => {
  if (!current || !travel?.engagementStats) return current

  return {
    favoritesCount: toDecrementedMetric(current.favoritesCount, travel.engagementStats.favoritesCount),
    wishlistCount: toDecrementedMetric(current.wishlistCount, travel.engagementStats.wishlistCount),
    visitedCount: toDecrementedMetric(current.visitedCount, travel.engagementStats.visitedCount),
    plannedCount: toDecrementedMetric(current.plannedCount, travel.engagementStats.plannedCount),
  }
}

const getDeleteErrorCopy = (error: unknown) => {
  const errorStatus =
    error && typeof error === 'object' && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : null
  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? '').toLowerCase()

  if (
    errorStatus === 404 ||
    message.includes('404') ||
    message.includes('not found')
  ) {
    return {
      isAlreadyDeleted: true,
      title: i18nT('shared:hooks.useMyTravels.marshrut_uzhe_udalen_ec82e839'),
      description: i18nT('shared:hooks.useMyTravels.obnovili_spisok_chtoby_sinhronizirovat_profi_e7550431'),
    }
  }

  if (errorStatus === 403 || message.includes('403') || message.includes('forbidden')) {
    return {
      isAlreadyDeleted: false,
      title: i18nT('shared:hooks.useMyTravels.net_dostupa_ca0e6d55'),
      description: i18nT('shared:hooks.useMyTravels.u_vas_net_prav_dlya_udaleniya_etogo_marshrut_40c0e5b8'),
    }
  }

  if (isTimeoutError(error)) {
    return {
      isAlreadyDeleted: false,
      title: i18nT('shared:hooks.useMyTravels.prevysheno_vremya_ozhidaniya_e93ccac1'),
      description: i18nT('shared:hooks.useMyTravels.proverte_internet_i_poprobuyte_snova_79ec3064'),
    }
  }

  if (isOfflineLikeError(error)) {
    return {
      isAlreadyDeleted: false,
      title: i18nT('shared:hooks.useMyTravels.problema_s_podklyucheniem_8bad85c4'),
      description: i18nT('shared:hooks.useMyTravels.proverte_internet_i_poprobuyte_snova_79ec3064'),
    }
  }

  return {
    isAlreadyDeleted: false,
    title: i18nT('shared:hooks.useMyTravels.ne_udalos_udalit_marshrut_de4a9f1c'),
    description: error instanceof Error && error.message ? error.message : i18nT('shared:hooks.useMyTravels.poprobuyte_pozzhe_c0c8a2b5'),
  }
}

// Пустой список и недоступный сервер — разные вещи. Без этого 5xx на
// /api/travels/ показывал пользователю «маршрутов нет» вместо ошибки: fetchMyTravels
// без throwOnError глотал сбой и возвращал [], а состояния ошибки у хука не было.
const getLoadErrorMessage = (error: unknown) => {
  if (isTimeoutError(error)) {
    return i18nT('shared:hooks.useMyTravels.prevysheno_vremya_ozhidaniya_e93ccac1')
  }
  if (isOfflineLikeError(error)) {
    return i18nT('errorsStatic:api.client.offline')
  }
  if (error instanceof Error && error.message) return error.message
  return i18nT('errorsStatic:api.common.unknownError')
}

/**
 * Результат счётчика черновиков: число либо `'failed'` — запрос упал. `null`
 * на месте вызова означает «не запрашивали» и в сам тип не входит.
 */
type DraftsCountProbe = number | 'failed';

// Черновики считает сервер: вкладки «Опубл.» и «Черновики» показывали разбивку
// первой страницы (15 + 5 при 365 маршрутах), потому что классификация шла по
// загруженным элементам. Просим у API только count по черновиковым статусам —
// perPage=1 не тянет список, а опубликованные выводим вычитанием из общего
// количества, чтобы сумма вкладок всегда сходилась со счётчиком «Маршруты».
const fetchDraftTravelsCount = async (userId: string | number, signal: AbortSignal): Promise<DraftsCountProbe> => {
  try {
    const payload = await fetchMyTravels({
      user_id: userId,
      page: 1,
      perPage: 1,
      includeDrafts: true,
      publicationStatus: DRAFT_PUBLICATION_STATUSES,
      throwOnError: true,
      signal,
    });
    return unwrapMyTravelsPayload(payload).total;
  } catch {
    // Счётчик — украшение вкладки: его сбой не должен ломать загрузку списка,
    // но и молчать о нём нельзя, иначе «упал» неотличим от «ещё не загружен».
    return 'failed';
  }
};

const toPublicationCounts = (
  total: number,
  draftsCount: DraftsCountProbe | null,
): TravelPublicationCounts | null => {
  if (typeof draftsCount !== 'number') return null;
  const drafts = Math.min(Math.max(0, draftsCount), total);
  return { published: Math.max(0, total - drafts), drafts };
};

interface AuthorTravelsPage {
  items: Travel[];
  total: number;
  engagementSummary: TravelEngagementStats | null;
  draftsCount: DraftsCountProbe | null;
}

type AuthorTravelsData = InfiniteData<AuthorTravelsPage, number>;

const flattenTravels = (pages: AuthorTravelsPage[]): Travel[] => {
  const seen = new Set<string>();
  return pages.flatMap((page) => page.items).filter((travel) => {
    const id = String(travel.id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const servedAuthorTotal = (pages: AuthorTravelsPage[]) => {
  const lastPage = pages.at(-1);
  return lastPage
    ? lastPage.total + blockHiddenCount(lastPage) || pages.reduce((total, page) => total + servedPageLength(page), 0)
    : 0;
};

const hasNextAuthorPage = (pages: AuthorTravelsPage[]) => {
  const lastPage = pages.at(-1);
  return Boolean(lastPage && servedPageLength(lastPage) > 0 &&
    flattenTravels(pages).length + pages.reduce((total, page) => total + blockHiddenCount(page), 0) < servedAuthorTotal(pages));
};

const authorTotal = (pages: AuthorTravelsPage[]) => {
  const visibleCount = flattenTravels(pages).length;
  const hiddenCount = pages.reduce((total, page) => total + blockHiddenCount(page), 0);
  // The common author-block guard decrements each page's total independently.
  // Pagination follows served rows; the UI count excludes every hidden page.
  return hiddenCount > 0 && !hasNextAuthorPage(pages)
    ? visibleCount
    : Math.max(visibleCount, servedAuthorTotal(pages) - hiddenCount);
};

export function useMyTravels({ userId, perPage, includeDrafts = false, publicationStatus, onTotalChange }: UseMyTravelsArgs): UseMyTravelsResult {
  const queryClient = useQueryClient();
  const owner = useQueryOwner();
  const targetUser = userId?.trim() || null;
  const publicationStatusKey = JSON.stringify([...new Set(publicationStatus ?? [])].sort());
  const publicationFilter = useMemo<readonly string[] | undefined>(() => {
    const statuses = JSON.parse(publicationStatusKey) as string[];
    return statuses.length ? statuses : undefined;
  }, [publicationStatusKey]);
  const queryKey = useMemo(() => queryKeys.authorTravels(owner, targetUser, {
    perPage, includeDrafts, publicationStatus: publicationFilter,
  }), [owner, targetUser, perPage, includeDrafts, publicationFilter]);
  const scope = useMemo(() => JSON.stringify(queryKey), [queryKey]);
  const currentScopeRef = useRef(scope);
  currentScopeRef.current = scope;
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Requested slices stay enabled while mounted, including a blurred profile.
  // An unvisited slice has an observer but never starts a list/count request.
  const [activation, setActivation] = useState<{ owner: string | null; scopes: Set<string> }>(
    () => ({ owner, scopes: new Set() }),
  );
  useEffect(() => {
    setActivation((current) => current.owner === owner ? current : { owner, scopes: new Set() });
  }, [owner]);
  const activated = activation.owner === owner && activation.scopes.has(scope);
  const [refreshing, setRefreshing] = useState<{ scope: string; query: unknown; operation: symbol } | null>(null);
  const [paginationStopped, setPaginationStopped] = useState<Set<string>>(() => new Set());
  const [removing, setRemoving] = useState<{ scope: string; query: unknown; id: number; operation: symbol } | null>(null);
  const loadInFlightRef = useRef<{ scope: string; query: unknown; promise: Promise<void> } | null>(null);
  const nextPageInFlightRef = useRef<{ query: unknown; operation: symbol } | null>(null);
  const deleteInFlightRef = useRef<{ query: unknown; operation: symbol } | null>(null);
  const requestSeqRef = useRef(0);

  const query = useInfiniteQuery({
    queryKey,
    enabled: Boolean(targetUser && activated),
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }): Promise<AuthorTravelsPage> => {
      const [payload, draftsCount] = await Promise.all([
        fetchMyTravels({
          user_id: targetUser!, page: pageParam, perPage, includeDrafts,
          publicationStatus: publicationFilter, throwOnError: true, signal,
        }),
        pageParam === 1 && includeDrafts && !publicationFilter
          ? fetchDraftTravelsCount(targetUser!, signal)
          : Promise.resolve<DraftsCountProbe | null>(null),
      ]);
      const { items, total, engagementSummary } = unwrapMyTravelsPayload(payload);
      return { items: items.map(normalizeToTravel), total, engagementSummary, draftsCount };
    },
    getNextPageParam: (_lastPage, pages, lastPageParam) =>
      hasNextAuthorPage(pages) ? lastPageParam + 1 : undefined,
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  const isInvalidated = useSyncExternalStore(
    useCallback((notify) => queryClient.getQueryCache().subscribe(notify), [queryClient]),
    useCallback(() => queryClient.getQueryState(queryKey)?.isInvalidated === true, [queryClient, queryKey]),
    () => false,
  );
  const currentQuery = queryClient.getQueryCache().find({ queryKey, exact: true });
  const hasVisibleRows = query.data?.pages.some((page) => page.items.length > 0) ?? false;
  const paused = query.fetchStatus === 'paused' && (!hasVisibleRows || isInvalidated);
  const loadError = query.isError && (!query.isFetchNextPageError || !hasVisibleRows);
  const error = targetUser && activated
    ? paused ? i18nT('errorsStatic:api.client.offline') : loadError ? getLoadErrorMessage(query.error) : null
    : null;
  const usableData = targetUser && activated && !error ? query.data : undefined;
  const pages = usableData?.pages;
  const myTravels = useMemo(() => flattenTravels(pages ?? []), [pages]);
  const hasHiddenRows = pages?.some((page) => blockHiddenCount(page) > 0) ?? false;
  const hiddenWindowIncomplete = Boolean(hasHiddenRows && pages && hasNextAuthorPage(pages));
  // Server totals/probes precede the newer client block policy. Unloaded rows
  // cannot prove its global counts; a complete window can count visible rows.
  const total = pages && !hiddenWindowIncomplete ? authorTotal(pages) : null;
  const engagementSummary = !hasHiddenRows
    ? pages?.find((page) => page.engagementSummary)?.engagementSummary ?? null
    : null;
  const ownsBreakdown = includeDrafts && !publicationFilter;
  const publicationCounts = ownsBreakdown && total != null
    ? hasHiddenRows
      ? myTravels.reduce<TravelPublicationCounts>((counts, travel) => {
          if (isTravelDraft(travel)) counts.drafts += 1;
          else counts.published += 1;
          return counts;
        }, { published: 0, drafts: 0 })
      : toPublicationCounts(total, pages?.[0]?.draftsCount ?? null)
    : null;
  const publicationCountsUnavailable = !error && ownsBreakdown &&
    (hiddenWindowIncomplete || (!hasHiddenRows && pages?.[0]?.draftsCount === 'failed'));
  const hasMore = Boolean(usableData && !error && !paginationStopped.has(scope) && !query.isFetchNextPageError && query.hasNextPage);
  const isLoading = Boolean(targetUser && !error && (!activated || query.isPending ||
    (!hasVisibleRows && hasMore) || (refreshing?.scope === scope && refreshing.query === currentQuery)));

  useEffect(() => {
    if (!targetUser) {
      onTotalChange?.(0);
    } else if (activated && (error || pages)) {
      onTotalChange?.(error ? null : total);
    }
  }, [targetUser, activated, error, pages, total, onTotalChange]);

  // Both scope and the actual Query instance must survive an await. Identity
  // cleanup removes instances; rollback must never recreate one it removed.
  const isCurrentScope = useCallback((originQuery: unknown) => {
    const auth = useAuthStore.getState();
    const liveOwner = auth.isAuthenticated ? auth.userId : null;
    return Boolean(originQuery) && mountedRef.current && currentScopeRef.current === scope &&
      (liveOwner == null ? null : String(liveOwner).trim() || null) ===
        (owner == null ? null : String(owner).trim() || null) &&
      queryClient.getQueryCache().find({ queryKey, exact: true }) === originQuery;
  }, [owner, queryClient, queryKey, scope]);

  const refetch = query.refetch;
  const load = useCallback((): Promise<void> => {
    if (!targetUser) return Promise.resolve();
    const originQuery = queryClient.getQueryCache().find({ queryKey, exact: true });
    if (!originQuery || !isCurrentScope(originQuery)) return Promise.resolve();
    if (loadInFlightRef.current?.scope === scope && loadInFlightRef.current.query === originQuery) {
      return loadInFlightRef.current.promise;
    }
    const operation = Symbol('author-list-refresh');
    ++requestSeqRef.current;
    setRefreshing({ scope, query: originQuery, operation });
    setPaginationStopped((current) => new Set([...current].filter((key) => key !== scope)));
    const promise: Promise<void> = Promise.resolve().then(async () => {
      try {
        if (!isCurrentScope(originQuery)) return;
        // Cancel/trim before enabling: optional-fetch and manual refetch then
        // share one request, and a late page cannot overwrite the new page 1.
        await queryClient.cancelQueries({ queryKey, exact: true });
        if (!isCurrentScope(originQuery)) return;
        queryClient.setQueryData<AuthorTravelsData>(queryKey, (current) => current ? {
          pages: current.pages.slice(0, 1), pageParams: current.pageParams.slice(0, 1),
        } : undefined);
        originQuery.invalidate();
        setActivation((current) => ({
          owner,
          scopes: new Set([...(current.owner === owner ? current.scopes : []), scope]),
        }));
        if (!isCurrentScope(originQuery)) return;
        const pending = refetch({ cancelRefetch: false });
        // A paused query is an honest offline state, not an indefinitely busy
        // refresh button. React Query resumes the same request on reconnect.
        if (queryClient.getQueryState(queryKey)?.fetchStatus === 'paused') {
          void pending.catch(() => undefined);
          return;
        }
        await pending;
      } finally {
        if (loadInFlightRef.current?.promise === promise) loadInFlightRef.current = null;
        if (mountedRef.current) setRefreshing((current) => current?.operation === operation ? null : current);
      }
    });
    loadInFlightRef.current = { scope, query: originQuery, promise };
    return promise;
  }, [targetUser, scope, queryClient, queryKey, isCurrentScope, owner, refetch]);

  const fetchNextPage = query.fetchNextPage;
  const loadMore = useCallback(async () => {
    if (!targetUser || isLoading || !hasMore || query.isFetching || !myTravels.length) return;
    const originQuery = queryClient.getQueryCache().find({ queryKey, exact: true });
    if (!isCurrentScope(originQuery) || nextPageInFlightRef.current?.query === originQuery) return;
    const sequence = ++requestSeqRef.current;
    const operation = Symbol('author-list-next-page');
    nextPageInFlightRef.current = { query: originQuery, operation };
    try {
      const result = await fetchNextPage({ cancelRefetch: false });
      if (!isCurrentScope(originQuery) || requestSeqRef.current !== sequence || !result.isError) return;
      setPaginationStopped((current) => new Set([...current, scope]));
      void showToastMessage({
        type: 'error',
        text1: i18nT('sharedStatic:myTravels.loadFailedTitle'),
        text2: getLoadErrorMessage(result.error),
        visibilityTime: 4000,
      });
    } finally {
      if (nextPageInFlightRef.current?.operation === operation) nextPageInFlightRef.current = null;
    }
  }, [targetUser, isLoading, hasMore, query.isFetching, myTravels.length, queryClient, queryKey, isCurrentScope, fetchNextPage, scope]);

  const remove = useCallback(async (travelId: number): Promise<boolean> => {
    const originQuery = queryClient.getQueryCache().find({ queryKey, exact: true });
    if (!targetUser || !originQuery || !isCurrentScope(originQuery) || deleteInFlightRef.current?.query === originQuery) return false;
    const operation = Symbol('author-list-delete');
    let previous: AuthorTravelsData | undefined;
    let optimistic: AuthorTravelsData | undefined;
    let optimisticDataUpdateCount: number | undefined;
    try {
      const ok = await confirmAction({
        title: i18nT('shared:hooks.useMyTravels.udalit_puteshestvie_64a5de65'),
        message: i18nT('shared:hooks.useMyTravels.udalit_etot_marshrut_deystvie_nelzya_otmenit_d24a1543'),
        confirmText: i18nT('common:action.delete'),
        cancelText: i18nT('common:action.cancel'),
      });
      if (!ok || !isCurrentScope(originQuery) || deleteInFlightRef.current?.query === originQuery) return false;
      deleteInFlightRef.current = { query: originQuery, operation };
      setRemoving({ scope, query: originQuery, id: travelId, operation });
      ++requestSeqRef.current;
      await queryClient.cancelQueries({ queryKey, exact: true });
      if (!isCurrentScope(originQuery)) return false;
      previous = queryClient.getQueryData<AuthorTravelsData>(queryKey);
      const deletedTravel = previous && flattenTravels(previous.pages).find((travel) => travel.id === travelId);
      if (previous && deletedTravel) {
        // Hide the row and update counters before the authoritative reload.
        optimistic = queryClient.setQueryData<AuthorTravelsData>(queryKey, {
          ...previous,
          pages: previous.pages.map((page) => {
            return {
              ...page,
              items: page.items.filter((travel) => travel.id !== travelId),
              total: Math.max(0, page.total - 1),
              engagementSummary: decrementSummaryByTravel(page.engagementSummary, deletedTravel),
              draftsCount: typeof page.draftsCount === 'number' && isTravelDraft(deletedTravel)
                ? Math.max(0, page.draftsCount - 1) : page.draftsCount,
            };
          }),
        });
        optimisticDataUpdateCount = originQuery.state.dataUpdateCount;
      }
      await deleteTravel(travelId);
      if (isCurrentScope(originQuery)) {
        void showToastMessage({
          type: 'success',
          text1: i18nT('shared:hooks.useMyTravels.marshrut_udalen_d9a3c536'),
          text2: i18nT('shared:hooks.useMyTravels.profil_obnovlen_b45689b2'),
        });
        await load();
      }
      return true;
    } catch (deleteError) {
      const copy = getDeleteErrorCopy(deleteError);
      if (isCurrentScope(originQuery)) {
        if (copy.isAlreadyDeleted) {
          void showToastMessage({ type: 'info', text1: copy.title, text2: copy.description });
          await load();
        } else {
          // A later successful GET wins even when structural sharing kept the
          // same data reference because its authoritative DTO was identical.
          if (previous && optimistic &&
            originQuery.state.dataUpdateCount === optimisticDataUpdateCount &&
            queryClient.getQueryData(queryKey) === optimistic) {
            queryClient.setQueryData(queryKey, previous);
          }
          void showToastMessage({ type: 'error', text1: copy.title, text2: copy.description, visibilityTime: 4000 });
          console.error('Error deleting travel:', deleteError);
        }
      }
      return copy.isAlreadyDeleted;
    } finally {
      if (deleteInFlightRef.current?.operation === operation) deleteInFlightRef.current = null;
      if (mountedRef.current) setRemoving((current) => current?.operation === operation ? null : current);
    }
  }, [queryClient, queryKey, targetUser, isCurrentScope, scope, load]);

  return {
    myTravels, engagementSummary, publicationCounts, publicationCountsUnavailable,
    isLoading, isLoadingMore: query.isFetchingNextPage,
    removingTravelId: removing?.scope === scope && removing.query === currentQuery ? removing.id : null,
    hasMore, error, load, loadMore, remove,
  };
}
