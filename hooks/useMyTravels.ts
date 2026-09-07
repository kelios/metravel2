import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  onTotalChange?: (total: number) => void;
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
   * страницах. null — счётчик ещё не получен или запрос за ним не удался.
   */
  publicationCounts: TravelPublicationCounts | null;
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

// Удаление уводит маршрут из своей вкладки сразу, не дожидаясь перезагрузки
// списка: иначе счётчик секунду показывает уже несуществующий маршрут.
const decrementCountsByTravel = (
  current: TravelPublicationCounts | null,
  travel: Travel | undefined,
): TravelPublicationCounts | null => {
  if (!current || !travel) return current
  return isTravelDraft(travel)
    ? { ...current, drafts: Math.max(0, current.drafts - 1) }
    : { ...current, published: Math.max(0, current.published - 1) }
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

// Черновики считает сервер: вкладки «Опубл.» и «Черновики» показывали разбивку
// первой страницы (15 + 5 при 365 маршрутах), потому что классификация шла по
// загруженным элементам. Просим у API только count по черновиковым статусам —
// perPage=1 не тянет список, а опубликованные выводим вычитанием из общего
// количества, чтобы сумма вкладок всегда сходилась со счётчиком «Маршруты».
const fetchDraftTravelsCount = async (userId: string | number): Promise<number | null> => {
  try {
    const payload = await fetchMyTravels({
      user_id: userId,
      page: 1,
      perPage: 1,
      includeDrafts: true,
      publicationStatus: DRAFT_PUBLICATION_STATUSES,
      throwOnError: true,
    });
    return unwrapMyTravelsPayload(payload).total;
  } catch {
    // Счётчик — украшение вкладки: его сбой не должен ломать загрузку списка.
    return null;
  }
};

const toPublicationCounts = (
  total: number,
  draftsCount: number | null,
): TravelPublicationCounts | null => {
  if (draftsCount == null) return null;
  const drafts = Math.min(Math.max(0, draftsCount), total);
  return { published: Math.max(0, total - drafts), drafts };
};

export function useMyTravels({ userId, perPage, includeDrafts = false, publicationStatus, onTotalChange }: UseMyTravelsArgs): UseMyTravelsResult {
  // Фильтр держим ключом, а не ссылкой: инлайновый массив у вызывающего иначе
  // пересоздавал бы load/loadMore на каждом рендере.
  const publicationStatusKey = publicationStatus?.length ? publicationStatus.join(',') : '';
  const publicationFilter = useMemo(
    () => (publicationStatusKey ? publicationStatusKey.split(',') : undefined),
    [publicationStatusKey],
  );
  const [myTravels, setMyTravels] = useState<Travel[]>([]);
  const [engagementSummary, setEngagementSummary] = useState<TravelEngagementStats | null>(null)
  const [publicationCounts, setPublicationCounts] = useState<TravelPublicationCounts | null>(null)
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [removingTravelId, setRemovingTravelId] = useState<number | null>(null)
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deleteInFlightRef = useRef<number | null>(null)
  const mountedRef = useRef(true)
  // Монотонный счётчик: и load, и loadMore инкрементят его. После await коммитит
  // только последний запрос — поздний loadMore не затирает свежий результат load
  // (например onRefresh во время подгрузки следующей страницы).
  const requestSeqRef = useRef(0)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const load = useCallback(async () => {
    const uid = userId;
    if (!uid) {
      setIsLoading(false);
      setIsLoadingMore(false);
      setRemovingTravelId(null)
      setPage(1);
      setTotalCount(0)
      setHasMore(false);
      setMyTravels([]);
      setEngagementSummary(null)
      setPublicationCounts(null)
      setError(null);
      return;
    }
    const seq = ++requestSeqRef.current;
    setIsLoading(true);
    setIsLoadingMore(false);
    setError(null);
    try {
      const [payload, draftsCount] = await Promise.all([
        fetchMyTravels({ user_id: uid, page: 1, perPage, includeDrafts, publicationStatus: publicationFilter, throwOnError: true }),
        // У среза по статусу своей разбивки нет: черновики и опубликованные
        // считает общий список, иначе каждая вкладка тянула бы лишний счётчик.
        includeDrafts && !publicationFilter ? fetchDraftTravelsCount(uid) : Promise.resolve<number | null>(null),
      ]);
      // Запрос вытеснен более новым load/loadMore или хук размонтирован — не коммитим.
      if (!mountedRef.current || seq !== requestSeqRef.current) return;
      const { items, total, engagementSummary: nextEngagementSummary } = unwrapMyTravelsPayload(payload);
      const normalized = items.map(normalizeToTravel);
      const effectiveTotal = total || normalized.length;

      setMyTravels(normalized);
      setEngagementSummary(nextEngagementSummary)
      setPublicationCounts(toPublicationCounts(effectiveTotal, draftsCount))
      setPage(1);
      setTotalCount(effectiveTotal)
      setHasMore(normalized.length < effectiveTotal && items.length > 0);
      setError(null);
      onTotalChange?.(effectiveTotal);
    } catch (loadError) {
      if (!mountedRef.current || seq !== requestSeqRef.current) return;
      setMyTravels([]);
      setEngagementSummary(null)
      setPublicationCounts(null)
      setPage(1);
      setTotalCount(0)
      setHasMore(false);
      setError(getLoadErrorMessage(loadError));
      onTotalChange?.(0);
    } finally {
      if (mountedRef.current && seq === requestSeqRef.current) setIsLoading(false);
    }
  }, [userId, perPage, includeDrafts, publicationFilter, onTotalChange]);

  const loadMore = useCallback(async () => {
    const uid = userId;
    if (!uid) return;
    if (isLoading || isLoadingMore || !hasMore) return;
    if (myTravels.length === 0) return;

    const nextPage = page + 1;
    const seq = ++requestSeqRef.current;
    setIsLoadingMore(true);
    try {
      const payload = await fetchMyTravels({ user_id: uid, page: nextPage, perPage, includeDrafts, publicationStatus: publicationFilter, throwOnError: true });
      // Вытеснен более новым load (onRefresh) / loadMore или unmount — не коммитим,
      // иначе устаревший merged затрёт свежую страницу 1.
      if (!mountedRef.current || seq !== requestSeqRef.current) return;
      const { items, total, engagementSummary: nextEngagementSummary } = unwrapMyTravelsPayload(payload);
      const normalized = items.map(normalizeToTravel);

      const existingIds = new Set(myTravels.map((travel) => String(travel.id)));
      const uniqueNext = normalized.filter((travel) => !existingIds.has(String(travel.id)));
      const merged = uniqueNext.length > 0 ? [...myTravels, ...uniqueNext] : myTravels;
      const effectiveTotal = total || merged.length;

      setMyTravels(merged);
      setEngagementSummary((current) => current ?? nextEngagementSummary)
      // Общее количество могло измениться между страницами — держим разбивку в
      // сумме с ним, иначе «Опубл.» разойдётся со счётчиком «Маршруты».
      setPublicationCounts((current) => (current ? toPublicationCounts(effectiveTotal, current.drafts) : current))
      setPage(nextPage);
      setTotalCount(effectiveTotal)
      setHasMore(merged.length < effectiveTotal && items.length > 0);
      onTotalChange?.(effectiveTotal);
    } catch (loadMoreError) {
      if (!mountedRef.current || seq !== requestSeqRef.current) return;
      // Уже загруженные страницы оставляем, но автоподгрузку глушим, иначе каждый
      // скролл к концу списка бьётся о тот же сбой. Возврат — через pull-to-refresh.
      setHasMore(false);
      void showToastMessage({
        type: 'error',
        text1: i18nT('sharedStatic:myTravels.loadFailedTitle'),
        text2: getLoadErrorMessage(loadMoreError),
        visibilityTime: 4000,
      })
    } finally {
      if (mountedRef.current && seq === requestSeqRef.current) setIsLoadingMore(false);
    }
  }, [userId, perPage, includeDrafts, publicationFilter, page, isLoading, isLoadingMore, hasMore, myTravels, onTotalChange]);

  const remove = useCallback(
    async (travelId: number): Promise<boolean> => {
      try {
        const ok = await confirmAction({
          title: i18nT('shared:hooks.useMyTravels.udalit_puteshestvie_64a5de65'),
          message: i18nT('shared:hooks.useMyTravels.udalit_etot_marshrut_deystvie_nelzya_otmenit_d24a1543'),
          confirmText: i18nT('shared:hooks.useMyTravels.udalit_c7e4f56b'),
          cancelText: i18nT('shared:hooks.useMyTravels.otmena_e1cbb99f'),
        });
        if (!ok) return false;

        if (deleteInFlightRef.current === travelId) return false

        const previousTravels = myTravels
        const deletedTravel = previousTravels.find((travel) => travel.id === travelId)
        const previousTotal = totalCount
        const previousCounts = publicationCounts
        const nextTravels = previousTravels.filter((travel) => travel.id !== travelId)
        const nextTotal = Math.max(0, previousTotal - 1)
        const nextCounts = decrementCountsByTravel(previousCounts, deletedTravel)

        deleteInFlightRef.current = travelId
        setRemovingTravelId(travelId)
        setMyTravels(nextTravels)
        setEngagementSummary((current) => decrementSummaryByTravel(current, deletedTravel))
        setPublicationCounts(nextCounts)
        setTotalCount(nextTotal)
        onTotalChange?.(nextTotal)

        await deleteTravel(travelId);
        void showToastMessage({
          type: 'success',
          text1: i18nT('shared:hooks.useMyTravels.marshrut_udalen_d9a3c536'),
          text2: i18nT('shared:hooks.useMyTravels.profil_obnovlen_b45689b2'),
        })
        await load();
        return true;
      } catch (error) {
        const deleteCopy = getDeleteErrorCopy(error)

        if (deleteCopy.isAlreadyDeleted) {
          void showToastMessage({
            type: 'info',
            text1: deleteCopy.title,
            text2: deleteCopy.description,
          })
          await load()
          return true
        } else {
          if (mountedRef.current) {
            setMyTravels(myTravels)
            setEngagementSummary(engagementSummary)
            setPublicationCounts(publicationCounts)
            setTotalCount(totalCount)
            onTotalChange?.(totalCount)
          }
          void showToastMessage({
            type: 'error',
            text1: deleteCopy.title,
            text2: deleteCopy.description,
            visibilityTime: 4000,
          })
          console.error('Error deleting travel:', error);
          return false
        }
      } finally {
        deleteInFlightRef.current = null
        if (mountedRef.current) setRemovingTravelId(null)
      }
    },
    [engagementSummary, load, myTravels, onTotalChange, publicationCounts, totalCount],
  );

  return { myTravels, engagementSummary, publicationCounts, isLoading, isLoadingMore, removingTravelId, hasMore, error, load, loadMore, remove };
}
